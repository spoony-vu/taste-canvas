import type { IncomingHttpHeaders } from "node:http";
import { beforeEach, describe, expect, test, vi } from "vitest";
import type { Manifest } from "../../src/lib/types";

vi.mock("../../api/_storage.js", () => ({
  readManifest: vi.fn(),
  readManifestSnapshot: vi.fn(),
  writeManifest: vi.fn(),
}));

const { readManifest, readManifestSnapshot, writeManifest } = await import("../../api/_storage.js");
const { default: manifestHandler } = await import("../../api/manifest.js");

function request(method: string, body?: unknown, headers: IncomingHttpHeaders = {}) {
  return {
    method,
    body,
    headers,
  };
}

function response() {
  return {
    statusCode: 200,
    headers: {} as Record<string, number | string | readonly string[]>,
    body: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
    setHeader(name: string, value: number | string | readonly string[]) {
      this.headers[name] = value;
    },
  };
}

describe("/api/manifest", () => {
  beforeEach(() => {
    vi.mocked(readManifest).mockReset();
    vi.mocked(readManifestSnapshot).mockReset();
    vi.mocked(writeManifest).mockReset();
    delete process.env.TASTE_API_KEY;
    delete process.env.VERCEL;
    delete process.env.NODE_ENV;
  });

  test("GET returns the stored manifest", async () => {
    const manifest: Manifest = { items: [] };
    vi.mocked(readManifest).mockResolvedValue(manifest);

    const res = response();
    await manifestHandler(request("GET"), res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual(manifest);
    expect(writeManifest).not.toHaveBeenCalled();
  });

  test("PUT rejects missing auth when an API key is configured", async () => {
    process.env.TASTE_API_KEY = "secret";

    const res = response();
    await manifestHandler(request("PUT", { items: [] }, { host: "example.com" }), res);

    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({ error: "Unauthorized" });
    expect(writeManifest).not.toHaveBeenCalled();
  });

  test("PUT fails closed on Vercel when the API key is missing", async () => {
    process.env.VERCEL = "1";

    const res = response();
    await manifestHandler(request("PUT", { items: [] }, { host: "example.com" }), res);

    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({ error: "Unauthorized" });
    expect(writeManifest).not.toHaveBeenCalled();
  });

  test("PUT allows missing auth only in local development", async () => {
    const manifest: Manifest = { items: [] };
    vi.mocked(readManifestSnapshot).mockResolvedValue({ manifest, etag: "etag-1" });
    vi.mocked(writeManifest).mockResolvedValue({});

    const res = response();
    await manifestHandler(request("PUT", manifest, { host: "localhost:3002" }), res);

    expect(res.statusCode).toBe(200);
    expect(writeManifest).toHaveBeenCalledWith(manifest, { ifMatch: "etag-1", overwrite: true });
  });

  test("PUT accepts same-origin browser requests when an API key is configured", async () => {
    process.env.TASTE_API_KEY = "secret";
    const manifest: Manifest = { items: [] };
    vi.mocked(readManifestSnapshot).mockResolvedValue({ manifest, etag: "etag-1" });
    vi.mocked(writeManifest).mockResolvedValue({});

    const res = response();
    await manifestHandler(
      request("PUT", manifest, {
        host: "taste.example",
        origin: "https://taste.example",
      }),
      res
    );

    expect(res.statusCode).toBe(200);
    expect(writeManifest).toHaveBeenCalledWith(manifest, { ifMatch: "etag-1", overwrite: true });
  });

  test("PUT rejects wrong bearer auth", async () => {
    process.env.TASTE_API_KEY = "secret";

    const res = response();
    await manifestHandler(
      request("PUT", { items: [] }, {
        authorization: "Bearer wrong",
        host: "example.com",
      }),
      res
    );

    expect(res.statusCode).toBe(401);
    expect(writeManifest).not.toHaveBeenCalled();
  });

  test("PUT accepts bearer auth and merges current-only items", async () => {
    process.env.TASTE_API_KEY = "secret";
    const current: Manifest = {
      items: [
        {
          id: "current1",
          title: "Current",
          url: "https://example.com/current",
          image: "https://example.com/current.png",
          category: "ui",
          tags: [],
          added: "2026-05-11",
        },
      ],
    };
    const incoming: Manifest = {
      items: [
        {
          id: "incoming",
          title: "Incoming",
          url: "https://example.com/incoming",
          image: "https://example.com/incoming.png",
          category: "ui",
          tags: [],
          added: "2026-05-11",
        },
      ],
    };
    vi.mocked(readManifestSnapshot).mockResolvedValue({ manifest: current, etag: "etag-1" });
    vi.mocked(writeManifest).mockResolvedValue({});

    const res = response();
    await manifestHandler(
      request("PUT", incoming, {
        authorization: "Bearer secret",
        host: "example.com",
      }),
      res
    );

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ ok: true, manifest: { items: [...incoming.items, ...current.items] } });
    expect(writeManifest).toHaveBeenCalledWith(
      { items: [...incoming.items, ...current.items] },
      { ifMatch: "etag-1", overwrite: true }
    );
  });

  test("parallel PUTs are serialized through the manifest mutation queue", async () => {
    process.env.TASTE_API_KEY = "secret";
    let inFlight = 0;
    let maxInFlight = 0;
    vi.mocked(readManifestSnapshot).mockResolvedValue({ manifest: { items: [] }, etag: "etag-1" });
    vi.mocked(writeManifest).mockImplementation(async () => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 5));
      inFlight -= 1;
    });

    const first: Manifest = { items: [] };
    const second: Manifest = {
      items: [
        {
          id: "abc12345",
          title: "Example",
          url: "https://example.com",
          image: "https://example.com/image.png",
          category: "ui",
          tags: [],
          added: "2026-05-11",
        },
      ],
    };

    const [firstRes, secondRes] = [response(), response()];
    await Promise.all([
      manifestHandler(
        request("PUT", first, { authorization: "Bearer secret", host: "example.com" }),
        firstRes
      ),
      manifestHandler(
        request("PUT", second, { authorization: "Bearer secret", host: "example.com" }),
        secondRes
      ),
    ]);

    expect(firstRes.body).toEqual({ ok: true, manifest: first });
    expect(secondRes.body).toEqual({ ok: true, manifest: second });
    expect(maxInFlight).toBe(1);
  });

  test("PATCH updates only the targeted item", async () => {
    process.env.TASTE_API_KEY = "secret";
    const manifest: Manifest = {
      items: [
        {
          id: "abc12345",
          title: "Before",
          url: "https://example.com",
          image: "https://example.com/image.png",
          category: "ui",
          tags: [],
          added: "2026-05-11",
        },
      ],
    };
    vi.mocked(readManifestSnapshot).mockResolvedValue({ manifest, etag: "etag-1" });
    vi.mocked(writeManifest).mockResolvedValue({});

    const res = response();
    await manifestHandler(
      request(
        "PATCH",
        { id: "abc12345", patch: { category: "tools" } },
        { authorization: "Bearer secret", host: "example.com" }
      ),
      res
    );

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ id: "abc12345", category: "tools" });
    expect(writeManifest).toHaveBeenCalledWith(
      { items: [{ ...manifest.items[0], category: "tools" }] },
      { ifMatch: "etag-1", overwrite: true }
    );
  });
});
