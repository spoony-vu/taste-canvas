import type { IncomingHttpHeaders, IncomingMessage, OutgoingHttpHeader } from "node:http";

export interface ApiRequest extends IncomingMessage {
  method?: string;
  headers: IncomingHttpHeaders;
  query: Record<string, string | string[] | undefined>;
  body?: unknown;
}

export interface ApiResponse {
  setHeader(name: string, value: number | string | readonly string[]): void;
  status(code: number): ApiResponse;
  json(payload: unknown): unknown;
  send?(body: unknown): unknown;
  getHeader?(name: string): OutgoingHttpHeader | undefined;
}
