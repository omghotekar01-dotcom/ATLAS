import {
  FunctionLookupResultSchema,
  InvalidInputError,
  normalizeSelector,
  SignatureCandidateSchema,
  UpstreamUnavailableError,
  type FunctionLookupResult,
  type Selector,
  type SignatureCandidate,
} from "@atlas/schemas";

import type { CanonicalFunctionRecord, FunctionSignatureRepository } from "./types.js";

export function parseSelectorInput(input: string): Selector {
  try {
    return normalizeSelector(input);
  } catch {
    throw new InvalidInputError(
      `"${input}" is not a function selector: expected 0x followed by 8 hex characters.`,
      "INVALID_SELECTOR",
    );
  }
}

type CandidateFields = Pick<
  CanonicalFunctionRecord,
  "signature" | "source" | "sourceId" | "entityKey" | "importedAt" | "datasetVersion" | "recordHash"
>;

export function toCandidate(record: CandidateFields): SignatureCandidate {
  return SignatureCandidateSchema.parse({
    signature: record.signature,
    source: record.source,
    sourceId: record.sourceId,
    entityKey: record.entityKey,
    provenance: {
      datasetVersion: record.datasetVersion,
      importedAt: record.importedAt,
      recordHash: record.recordHash,
    },
  });
}

/**
 * Resolves a selector to every canonical candidate. No candidate is dropped or
 * ranked; collisions are returned as-is with `ambiguous: true`.
 */
export async function lookupFunction(
  repository: FunctionSignatureRepository,
  selectorInput: string,
): Promise<FunctionLookupResult> {
  const selector = parseSelectorInput(selectorInput);

  let records: readonly CanonicalFunctionRecord[];
  try {
    records = await repository.findBySelector(selector);
  } catch (error) {
    throw new UpstreamUnavailableError(
      "The signature registry could not be queried.",
      { selector },
      { cause: error },
    );
  }

  const candidates = records
    .map(toCandidate)
    .sort(
      (left, right) =>
        left.provenance.recordHash.localeCompare(right.provenance.recordHash) ||
        left.sourceId.localeCompare(right.sourceId),
    );

  const warnings: string[] = [];
  if (candidates.length > 1) {
    warnings.push(
      `Selector ${selector} has ${candidates.length} canonical signatures. ATLAS does not rank them as more or less likely.`,
    );
  }

  return FunctionLookupResultSchema.parse({
    identifier: selector,
    kind: "function",
    ambiguous: candidates.length > 1,
    candidates,
    registry: "arkiv-rabdi",
    warnings,
  });
}
