import {
  ApiErrorSchema,
  CalldataDecodeResultSchema,
  EventLookupResultSchema,
  FunctionLookupResultSchema,
  FunctionSearchResultSchema,
  HealthResponseSchema,
  LogDecodeResultSchema,
  TransactionInvestigationSchema,
  type CalldataDecodeResult,
  type EventLookupResult,
  type FunctionLookupResult,
  type FunctionSearchResult,
  type HealthResponse,
  type LogDecodeResult,
  type LogInput,
  type TransactionInvestigation,
} from "@atlas/schemas";
import { z } from "zod";

import { AtlasSdkError } from "./errors.js";

export interface AtlasClientOptions {
  /** API origin, e.g. https://atlas.example.com. Defaults to ATLAS_API_URL. */
  baseUrl?: string;
  fetch?: typeof globalThis.fetch;
  timeoutMs?: number;
  headers?: Record<string, string>;
}

export interface SearchOptions {
  limit?: number;
  cursor?: string;
}

export const DEFAULT_BASE_URL = "http://localhost:3000";
export const DEFAULT_TIMEOUT_MS = 15_000;

const LogDecodeResponseSchema = z.object({ results: z.array(z.unknown()) });

function resolveBaseUrl(input: string | undefined): string {
  const raw = (input ?? process.env.ATLAS_API_URL ?? DEFAULT_BASE_URL).trim();
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new AtlasSdkError("INVALID_INPUT", `ATLAS API URL "${raw}" is not a valid URL.`);
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new AtlasSdkError("INVALID_INPUT", "The ATLAS API URL must use http or https.");
  }
  return url.toString().replace(/\/+$/, "");
}

export class AtlasClient {
  readonly baseUrl: string;
  readonly timeoutMs: number;
  private readonly fetchImpl: typeof globalThis.fetch;
  private readonly headers: Record<string, string>;

  constructor(options: AtlasClientOptions = {}) {
    this.baseUrl = resolveBaseUrl(options.baseUrl);
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.fetchImpl = options.fetch ?? globalThis.fetch;
    this.headers = {
      accept: "application/json",
      ...options.headers,
    };
  }

  private async request<T>(
    path: string,
    schema: z.ZodType<T>,
    init: { method?: string; body?: unknown; query?: Record<string, string | undefined> } = {},
  ): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`);
    for (const [key, value] of Object.entries(init.query ?? {})) {
      if (value !== undefined) url.searchParams.set(key, value);
    }

    let response: Response;
    try {
      response = await this.fetchImpl(url, {
        method: init.method ?? "GET",
        headers: {
          ...this.headers,
          ...(init.body !== undefined ? { "content-type": "application/json" } : {}),
        },
        ...(init.body !== undefined ? { body: JSON.stringify(init.body) } : {}),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (error) {
      const reason =
        error instanceof Error && error.name === "TimeoutError"
          ? `The ATLAS API did not respond within ${this.timeoutMs} ms.`
          : `Could not reach the ATLAS API at ${this.baseUrl}.`;
      throw new AtlasSdkError("NETWORK_ERROR", reason, { cause: error });
    }

    const text = await response.text();
    let payload: unknown;
    try {
      payload = text.length > 0 ? JSON.parse(text) : null;
    } catch {
      throw new AtlasSdkError(
        "INVALID_RESPONSE",
        `The ATLAS API returned a non-JSON response (HTTP ${response.status}).`,
        { status: response.status },
      );
    }

    if (!response.ok) {
      const parsed = ApiErrorSchema.safeParse(payload);
      if (parsed.success) {
        throw new AtlasSdkError(parsed.data.error.code, parsed.data.error.message, {
          status: response.status,
          requestId: parsed.data.error.requestId,
          details: parsed.data.error.details,
        });
      }
      throw new AtlasSdkError(
        "UPSTREAM_UNAVAILABLE",
        `The ATLAS API failed with HTTP ${response.status}.`,
        { status: response.status },
      );
    }

    const result = schema.safeParse(payload);
    if (!result.success) {
      throw new AtlasSdkError("INVALID_RESPONSE", "The ATLAS API returned an unexpected payload.", {
        status: response.status,
        details: { issues: result.error.issues.map((issue) => issue.path.join(".")) },
      });
    }
    return result.data;
  }

  health(): Promise<HealthResponse> {
    return this.request("/health", HealthResponseSchema);
  }

  lookupFunction(selector: string): Promise<FunctionLookupResult> {
    return this.request(
      `/v1/functions/${encodeURIComponent(selector)}`,
      FunctionLookupResultSchema,
    );
  }

  searchFunctions(query: string, options: SearchOptions = {}): Promise<FunctionSearchResult> {
    return this.request("/v1/functions/search", FunctionSearchResultSchema, {
      query: {
        q: query,
        ...(options.limit !== undefined ? { limit: String(options.limit) } : {}),
        ...(options.cursor !== undefined ? { cursor: options.cursor } : {}),
      },
    });
  }

  decodeCalldata(calldata: string): Promise<CalldataDecodeResult> {
    return this.request("/v1/decode/calldata", CalldataDecodeResultSchema, {
      method: "POST",
      body: { calldata },
    });
  }

  lookupEvent(topic0: string): Promise<EventLookupResult> {
    return this.request(`/v1/events/${encodeURIComponent(topic0)}`, EventLookupResultSchema);
  }

  async decodeLogs(logs: readonly LogInput[]): Promise<LogDecodeResult[]> {
    const decoded = await this.request<{ results: unknown[] }>(
      "/v1/decode/logs",
      LogDecodeResponseSchema,
      {
        method: "POST",
        body: { logs },
      },
    );
    try {
      return decoded.results.map((entry) => LogDecodeResultSchema.parse(entry));
    } catch (error) {
      throw new AtlasSdkError(
        "INVALID_RESPONSE",
        "The ATLAS API returned an unexpected log payload.",
        {
          cause: error,
        },
      );
    }
  }

  analyzeTransaction(input: { chainId: number; hash: string }): Promise<TransactionInvestigation> {
    return this.request("/v1/transactions/analyze", TransactionInvestigationSchema, {
      method: "POST",
      body: input,
    });
  }
}
