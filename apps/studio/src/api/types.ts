import type { AtlasErrorCode, FunctionLookupResult, FunctionSearchResult } from "@atlas/schemas";

export type {
  CalldataDecodeResult,
  CommunityLookupResult,
  CalldataDecodeResult as DecodeCalldataResponse,
  FunctionLookupResult,
  FunctionLookupResult as FunctionLookupResponse,
  FunctionSearchResult,
  FunctionSearchResult as FunctionSearchResponse,
  EventLookupResult,
  HealthResponse,
  LogDecodeResult,
  TransactionInvestigation,
  SignatureCandidate,
  SignatureCandidate as FunctionCandidate,
} from "@atlas/schemas";

export type ExplorerResponse = FunctionLookupResult | FunctionSearchResult;

export type ApiResult<T> =
  | { kind: "unconfigured" }
  | { kind: "network-error"; message: string }
  | { kind: "http-error"; status: number; code: AtlasErrorCode | null; message: string }
  | { kind: "empty" }
  | { kind: "ok"; data: T; sample?: boolean };
