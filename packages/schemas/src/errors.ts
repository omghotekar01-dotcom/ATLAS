import { z } from "zod";

export const AtlasErrorCodeSchema = z.enum([
  "INVALID_INPUT",
  "INVALID_SELECTOR",
  "INVALID_TOPIC0",
  "NOT_FOUND",
  "AMBIGUOUS_RESULT",
  "DECODE_FAILED",
  "UPSTREAM_UNAVAILABLE",
  "RATE_LIMITED",
  "UNAUTHORIZED",
  "INTERNAL",
]);

export const ApiErrorSchema = z.object({
  error: z.object({
    code: AtlasErrorCodeSchema,
    message: z.string().trim().min(1),
    details: z.record(z.string(), z.unknown()).nullable(),
    requestId: z.string().trim().min(1),
  }),
});

export type AtlasErrorCode = z.infer<typeof AtlasErrorCodeSchema>;
export type ApiError = z.infer<typeof ApiErrorSchema>;

export class AtlasError extends Error {
  readonly code: AtlasErrorCode;
  readonly details: Record<string, unknown> | null;

  constructor(
    code: AtlasErrorCode,
    message: string,
    details: Record<string, unknown> | null = null,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = new.target.name;
    this.code = code;
    this.details = details;
  }
}

export class InvalidInputError extends AtlasError {
  constructor(
    message: string,
    code: "INVALID_INPUT" | "INVALID_SELECTOR" | "INVALID_TOPIC0" = "INVALID_INPUT",
  ) {
    super(code, message);
  }
}

export class NotFoundError extends AtlasError {
  constructor(message: string, details: Record<string, unknown> | null = null) {
    super("NOT_FOUND", message, details);
  }
}

export class AmbiguousResultError extends AtlasError {
  constructor(message: string, details: Record<string, unknown> | null = null) {
    super("AMBIGUOUS_RESULT", message, details);
  }
}

export class DecodeFailureError extends AtlasError {
  constructor(message: string, details: Record<string, unknown> | null = null) {
    super("DECODE_FAILED", message, details);
  }
}

export class UpstreamUnavailableError extends AtlasError {
  constructor(
    message: string,
    details: Record<string, unknown> | null = null,
    options?: ErrorOptions,
  ) {
    super("UPSTREAM_UNAVAILABLE", message, details, options);
  }
}

export class RateLimitedError extends AtlasError {
  constructor(message: string, details: Record<string, unknown> | null = null) {
    super("RATE_LIMITED", message, details);
  }
}

export class AuthorizationError extends AtlasError {
  constructor(message: string, details: Record<string, unknown> | null = null) {
    super("UNAUTHORIZED", message, details);
  }
}

export interface ErrorPresentation {
  httpStatus: 400 | 401 | 404 | 422 | 429 | 500 | 502;
  cliExitCode: 1 | 2 | 3 | 4;
}

const ERROR_PRESENTATIONS: Record<AtlasErrorCode, ErrorPresentation> = {
  INVALID_INPUT: { httpStatus: 400, cliExitCode: 2 },
  INVALID_SELECTOR: { httpStatus: 400, cliExitCode: 2 },
  INVALID_TOPIC0: { httpStatus: 400, cliExitCode: 2 },
  NOT_FOUND: { httpStatus: 404, cliExitCode: 3 },
  AMBIGUOUS_RESULT: { httpStatus: 422, cliExitCode: 4 },
  DECODE_FAILED: { httpStatus: 422, cliExitCode: 4 },
  UPSTREAM_UNAVAILABLE: { httpStatus: 502, cliExitCode: 1 },
  RATE_LIMITED: { httpStatus: 429, cliExitCode: 1 },
  UNAUTHORIZED: { httpStatus: 401, cliExitCode: 1 },
  INTERNAL: { httpStatus: 500, cliExitCode: 1 },
};

export function presentAtlasError(error: AtlasError): ErrorPresentation {
  return ERROR_PRESENTATIONS[error.code];
}

export function toApiError(error: AtlasError, requestId: string): ApiError {
  return ApiErrorSchema.parse({
    error: {
      code: error.code,
      message: error.message,
      details: error.details,
      requestId,
    },
  });
}
