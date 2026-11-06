import {
  ApiErrorSchema,
  CalldataDecodeResultSchema,
  CommunityLookupResultSchema,
  EventLookupResultSchema,
  FunctionLookupResultSchema,
  FunctionSearchResultSchema,
  HealthResponseSchema,
  LogDecodeResultSchema,
  TransactionInvestigationSchema,
} from "@atlas/schemas";
import { z } from "zod";
import type {
  ApiResult,
  CalldataDecodeResult,
  CommunityLookupResult,
  EventLookupResult,
  FunctionLookupResult,
  FunctionSearchResult,
  HealthResponse,
  LogDecodeResult,
  TransactionInvestigation,
} from "./types";

const LogDecodeResponseSchema = z.object({ results: z.array(LogDecodeResultSchema) });

/** Base URL from VITE_ATLAS_API_URL. Undefined means no request will be sent. */
export function getApiBaseUrl(): string | undefined {
  const raw = import.meta.env.VITE_ATLAS_API_URL?.trim();
  return raw ? raw.replace(/\/+$/, "") : undefined;
}

async function request<T>(
  path: string,
  schema: { safeParse: (input: unknown) => { success: true; data: T } | { success: false } },
  init?: RequestInit,
  isEmpty?: (data: T) => boolean,
): Promise<ApiResult<T>> {
  const base = getApiBaseUrl();
  if (!base) return { kind: "unconfigured" };

  let response: Response;
  try {
    response = await fetch(`${base}${path}`, {
      ...init,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...init?.headers,
      },
      signal: init?.signal ?? AbortSignal.timeout(8000),
    });
  } catch {
    return {
      kind: "network-error",
      message: "The API could not be reached. Check the configured URL and network connection.",
    };
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return {
      kind: "http-error",
      status: response.status,
      code: null,
      message: "The API returned an invalid JSON response.",
    };
  }

  if (!response.ok) {
    const apiError = ApiErrorSchema.safeParse(body);
    return {
      kind: "http-error",
      status: response.status,
      code: apiError.success ? apiError.data.error.code : null,
      message: apiError.success
        ? apiError.data.error.message
        : response.statusText || "Request failed.",
    };
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return {
      kind: "http-error",
      status: response.status,
      code: null,
      message: "The API response did not match the ATLAS contract.",
    };
  }

  if (isEmpty?.(parsed.data)) return { kind: "empty" };
  return { kind: "ok", data: parsed.data };
}

export const atlasClient = {
  getFunctionBySelector: (selector: string) =>
    request<FunctionLookupResult>(
      `/v1/functions/${encodeURIComponent(selector)}`,
      FunctionLookupResultSchema,
      undefined,
      (data) => data.candidates.length === 0,
    ),

  searchFunctions: (query: string) =>
    request<FunctionSearchResult>(
      `/v1/functions/search?q=${encodeURIComponent(query)}&limit=20`,
      FunctionSearchResultSchema,
      undefined,
      (data) => data.items.length === 0,
    ),

  lookupCommunity: (selector: string) =>
    request<CommunityLookupResult>(
      `/v1/community/4byte/${encodeURIComponent(selector)}`,
      CommunityLookupResultSchema,
      undefined,
      (data) => data.candidates.length === 0,
    ),

  decodeCalldata: (calldata: string) =>
    request<CalldataDecodeResult>(
      "/v1/decode/calldata",
      CalldataDecodeResultSchema,
      {
        method: "POST",
        body: JSON.stringify({ calldata, strict: false }),
      },
      (data) => data.decoded.length === 0,
    ),

  getEventByTopic0: (topic0: string) =>
    request<EventLookupResult>(
      `/v1/events/${encodeURIComponent(topic0)}`,
      EventLookupResultSchema,
      undefined,
      (data) => data.candidates.length === 0,
    ),

  decodeLogs: (logs: readonly { topics: string[]; data: string }[]) =>
    request<{ results: LogDecodeResult[] }>("/v1/decode/logs", LogDecodeResponseSchema, {
      method: "POST",
      body: JSON.stringify({ logs }),
    }),

  analyzeTransaction: (input: { chainId: number; hash: string }) =>
    request<TransactionInvestigation>("/v1/transactions/analyze", TransactionInvestigationSchema, {
      method: "POST",
      body: JSON.stringify(input),
    }),

  health: () => request<HealthResponse>("/health", HealthResponseSchema),
};
