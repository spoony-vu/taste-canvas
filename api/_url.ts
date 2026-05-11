import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { HttpError } from "./_errors.js";

const DNS_CACHE_TTL_MS = 60_000;
const DNS_TIMEOUT_MS = 2_000;
const dnsCache = new Map<string, { expires: number; addresses: string[] }>();

export interface FetchBufferOptions {
  timeoutMs: number;
  maxBytes: number;
  accept?: string;
  allowedContentTypes?: RegExp[];
  headers?: Record<string, string>;
  maxRedirects?: number;
}

export interface FetchTextOptions extends FetchBufferOptions {
  decoder?: BufferEncoding;
}

export function parsePublicHttpUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new HttpError(400, "Invalid URL", "invalid_url");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new HttpError(400, "URL must use http or https", "unsupported_url_protocol");
  }
  if (url.username || url.password) {
    throw new HttpError(400, "URL credentials are not allowed", "url_credentials_not_allowed");
  }
  if (!url.hostname) {
    throw new HttpError(400, "URL host is required", "missing_url_host");
  }
  return url;
}

export async function assertPublicHttpUrl(raw: string | URL): Promise<URL> {
  const url = typeof raw === "string" ? parsePublicHttpUrl(raw) : parsePublicHttpUrl(raw.href);
  const addresses = await resolveHost(url.hostname);
  if (!addresses.length) {
    throw new HttpError(400, "URL host did not resolve", "host_not_resolved");
  }
  for (const address of addresses) {
    if (isBlockedAddress(address)) {
      throw new HttpError(400, "URL resolves to a blocked network address", "blocked_url_host");
    }
  }
  return url;
}

export async function fetchPublicUrlBuffer(
  raw: string,
  options: FetchBufferOptions
): Promise<{ buffer: Buffer; contentType: string; finalUrl: string }> {
  const maxRedirects = options.maxRedirects ?? 3;
  let url = await assertPublicHttpUrl(raw);

  for (let redirect = 0; redirect <= maxRedirects; redirect++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options.timeoutMs);
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        redirect: "manual",
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; TasteCanvas/1.0)",
          ...(options.accept ? { Accept: options.accept } : {}),
          ...options.headers,
        },
      });
      const location = response.headers.get("location");
      if (isRedirect(response.status) && location) {
        if (redirect === maxRedirects) {
          throw new HttpError(400, "Too many redirects", "too_many_redirects");
        }
        url = await assertPublicHttpUrl(new URL(location, url).href);
        continue;
      }

      if (!response.ok) {
        throw new HttpError(502, `Upstream returned ${response.status}`, "upstream_bad_status");
      }

      const contentType = response.headers.get("content-type") ?? "";
      if (options.allowedContentTypes?.length && !options.allowedContentTypes.some((pattern) => pattern.test(contentType))) {
        throw new HttpError(415, "Unsupported upstream content type", "unsupported_content_type");
      }

      const length = response.headers.get("content-length");
      if (length && Number(length) > options.maxBytes) {
        throw new HttpError(413, "Upstream response is too large", "upstream_too_large");
      }

      return {
        buffer: await readResponseBuffer(response, options.maxBytes),
        contentType,
        finalUrl: url.href,
      };
    } catch (error) {
      if (isAbortError(error)) {
        throw new HttpError(504, "Upstream request timed out", "upstream_timeout");
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  throw new HttpError(400, "Too many redirects", "too_many_redirects");
}

export async function fetchPublicUrlText(raw: string, options: FetchTextOptions): Promise<string> {
  const { buffer } = await fetchPublicUrlBuffer(raw, options);
  return buffer.toString(options.decoder ?? "utf-8");
}

export function createSafeRequestGate() {
  const checked = new Map<string, Promise<boolean>>();

  return async function isAllowed(raw: string): Promise<boolean> {
    let url: URL;
    try {
      url = parsePublicHttpUrl(raw);
    } catch {
      return false;
    }

    const key = `${url.protocol}//${url.host}`;
    let promise = checked.get(key);
    if (!promise) {
      promise = assertPublicHttpUrl(url).then(
        () => true,
        () => false
      );
      checked.set(key, promise);
    }
    return promise;
  };
}

async function readResponseBuffer(response: Response, maxBytes: number): Promise<Buffer> {
  if (!response.body) return Buffer.alloc(0);

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => {});
      throw new HttpError(413, "Upstream response is too large", "upstream_too_large");
    }
    chunks.push(value);
  }

  return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)), total);
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

async function resolveHost(hostname: string): Promise<string[]> {
  const literalVersion = isIP(hostname);
  if (literalVersion) return [hostname];

  const cached = dnsCache.get(hostname);
  if (cached && cached.expires > Date.now()) return cached.addresses;

  let records: { address: string; family: number }[];
  try {
    records = await withTimeout(lookup(hostname, { all: true, verbatim: false }), DNS_TIMEOUT_MS);
  } catch {
    throw new HttpError(400, "URL host did not resolve", "host_not_resolved");
  }
  const addresses = records.map((record) => record.address);
  dnsCache.set(hostname, { addresses, expires: Date.now() + DNS_CACHE_TTL_MS });
  return addresses;
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_resolve, reject) => {
        timeout = setTimeout(() => reject(new Error("Timed out")), timeoutMs);
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

function isRedirect(status: number): boolean {
  return status === 301 || status === 302 || status === 303 || status === 307 || status === 308;
}

function isBlockedAddress(address: string): boolean {
  const normalized = normalizeAddress(address);
  const version = isIP(normalized);
  if (version === 4) return isBlockedIpv4(normalized);
  if (version === 6) return isBlockedIpv6(normalized);
  return true;
}

function normalizeAddress(address: string): string {
  if (address.startsWith("::ffff:")) {
    return address.slice("::ffff:".length);
  }
  return address;
}

function isBlockedIpv4(address: string): boolean {
  const parts = address.split(".").map((part) => Number(part));
  const [a, b] = parts;
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 198 && (b === 18 || b === 19)) return true;
  if (a >= 224) return true;
  return false;
}

function isBlockedIpv6(address: string): boolean {
  const lower = address.toLowerCase();
  if (lower === "::" || lower === "::1") return true;
  if (lower.startsWith("fc") || lower.startsWith("fd")) return true;
  if (lower.startsWith("fe8") || lower.startsWith("fe9") || lower.startsWith("fea") || lower.startsWith("feb")) {
    return true;
  }
  if (lower.startsWith("ff")) return true;
  return false;
}
