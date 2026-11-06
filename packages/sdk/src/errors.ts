import type { AtlasErrorCode } from "@atlas/schemas";

export type AtlasSdkErrorCode = AtlasErrorCode | "NETWORK_ERROR" | "INVALID_RESPONSE";

/** Every SDK failure is typed and carries the API request id when there is one. */
export class AtlasSdkError extends Error {
  readonly code: AtlasSdkErrorCode;
  readonly status: number | null;
  readonly requestId: string | null;
  readonly details: Record<string, unknown> | null;

  constructor(
    code: AtlasSdkErrorCode,
    message: string,
    options: {
      status?: number | null;
      requestId?: string | null;
      details?: Record<string, unknown> | null;
      cause?: unknown;
    } = {},
  ) {
    super(message, options.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = "AtlasSdkError";
    this.code = code;
    this.status = options.status ?? null;
    this.requestId = options.requestId ?? null;
    this.details = options.details ?? null;
  }
}
