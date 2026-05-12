export class HttpError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(
    status: number,
    message: string,
    code = "request_failed"
  ) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.code = code;
  }
}

export function errorPayload(error: unknown): { error: string; code?: string } {
  if (error instanceof HttpError) {
    return { error: error.message, code: error.code };
  }
  return { error: error instanceof Error ? error.message : String(error) };
}

export function statusForError(error: unknown, fallback = 500): number {
  return error instanceof HttpError ? error.status : fallback;
}
