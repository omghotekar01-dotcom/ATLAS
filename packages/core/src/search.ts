import {
  FunctionSearchResultSchema,
  InvalidInputError,
  UpstreamUnavailableError,
  type FunctionSearchResult,
} from "@atlas/schemas";

import { toCandidate } from "./resolver.js";
import type { FunctionSignatureRepository } from "./types.js";

export const SEARCH_MIN_QUERY_LENGTH = 1;
export const SEARCH_MAX_QUERY_LENGTH = 200;
export const SEARCH_DEFAULT_LIMIT = 20;
export const SEARCH_MAX_LIMIT = 100;

export function parseSearchLimit(limit: number | undefined): number {
  const value = limit ?? SEARCH_DEFAULT_LIMIT;
  if (!Number.isInteger(value) || value < 1 || value > SEARCH_MAX_LIMIT) {
    throw new InvalidInputError(`limit must be an integer from 1 to ${SEARCH_MAX_LIMIT}.`);
  }
  return value;
}

/**
 * Searches canonical signatures by signature text. The query is matched
 * literally (case-insensitive) against the canonical signature; the repository
 * adapter owns the actual scan strategy.
 */
export async function searchFunctions(
  repository: FunctionSignatureRepository,
  queryInput: string,
  options: { limit?: number; cursor?: string } = {},
): Promise<FunctionSearchResult> {
  const query = queryInput.trim();
  if (query.length < SEARCH_MIN_QUERY_LENGTH) {
    throw new InvalidInputError(
      `Search query must be at least ${SEARCH_MIN_QUERY_LENGTH} characters.`,
    );
  }
  if (query.length > SEARCH_MAX_QUERY_LENGTH) {
    throw new InvalidInputError(
      `Search query must be at most ${SEARCH_MAX_QUERY_LENGTH} characters.`,
    );
  }

  const limit = parseSearchLimit(options.limit);

  let page: Awaited<ReturnType<FunctionSignatureRepository["searchBySignature"]>>;
  try {
    page = await repository.searchBySignature(query, {
      limit,
      ...(options.cursor ? { cursor: options.cursor } : {}),
    });
  } catch (error) {
    throw new UpstreamUnavailableError(
      "The signature registry could not be searched.",
      { query },
      { cause: error },
    );
  }

  const items = page.items.map((record) => ({
    ...toCandidate(record),
    selector: record.selector,
  }));

  return FunctionSearchResultSchema.parse({
    items,
    pagination: { nextCursor: page.nextCursor },
  });
}
