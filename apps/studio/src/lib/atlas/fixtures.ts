/**
 * SAMPLE DATA — NOT LIVE. Used only when the user explicitly enables preview mode.
 */
import {
  CalldataDecodeResultSchema,
  FunctionLookupResultSchema,
  FunctionSearchResultSchema,
  type CalldataDecodeResult,
} from "@atlas/schemas";
import type { ExplorerResponse } from "@/api/types";

const importedAt = "2026-11-01T09:00:00.000Z";
const datasetVersion = "sample-preview";

const SAMPLE = [
  {
    selector: "0xa9059cbb",
    signature: "transfer(address,uint256)",
    source: "sample-preview",
    sourceId: "sample-function-1",
    entityKey: "sample-entity-1",
    provenance: {
      datasetVersion,
      importedAt,
      recordHash: `0x${"1".repeat(64)}`,
    },
  },
  {
    selector: "0xa9059cbb",
    signature: "many_msg_babbage(bytes1)",
    source: "sample-preview",
    sourceId: "sample-function-2",
    entityKey: "sample-entity-2",
    provenance: {
      datasetVersion,
      importedAt,
      recordHash: `0x${"2".repeat(64)}`,
    },
  },
  {
    selector: "0x095ea7b3",
    signature: "approve(address,uint256)",
    source: "sample-preview",
    sourceId: "sample-function-3",
    entityKey: "sample-entity-3",
    provenance: {
      datasetVersion,
      importedAt,
      recordHash: `0x${"3".repeat(64)}`,
    },
  },
] as const;

function findCandidates(query: string) {
  const normalized = query.trim().toLowerCase();
  return SAMPLE.filter(
    (candidate) =>
      candidate.selector === normalized || candidate.signature.toLowerCase().includes(normalized),
  );
}

export function sampleLookup(query: string): ExplorerResponse {
  const candidates = findCandidates(query);
  if (/^0x[0-9a-f]{8}$/i.test(query.trim())) {
    return FunctionLookupResultSchema.parse({
      identifier: query.trim(),
      kind: "function",
      ambiguous: candidates.length > 1,
      candidates,
      registry: "sample-preview",
      warnings: ["Sample fixture only; this is not a live registry result."],
    });
  }

  return FunctionSearchResultSchema.parse({
    items: candidates,
    pagination: { nextCursor: null },
  });
}

function decodeSampleArguments(signature: string, words: string[]) {
  if (signature === "transfer(address,uint256)" || signature === "approve(address,uint256)") {
    if (words.length < 2) return null;
    return [
      {
        name: signature.startsWith("transfer") ? "to" : "spender",
        type: "address",
        value: `0x${words[0]!.slice(-40)}`,
      },
      { name: "amount", type: "uint256", value: BigInt(`0x${words[1]}`).toString() },
    ];
  }
  if (signature === "many_msg_babbage(bytes1)") {
    if (words.length < 1) return null;
    return [{ name: "arg0", type: "bytes1", value: `0x${words[0]!.slice(0, 2)}` }];
  }
  return null;
}

export function sampleDecode(selector: string, words: string[]): CalldataDecodeResult {
  const candidates = findCandidates(selector);
  return CalldataDecodeResultSchema.parse({
    selector,
    ambiguous: candidates.length > 1,
    decoded: candidates.map((candidate) => {
      const arguments_ = decodeSampleArguments(candidate.signature, words);
      if (!arguments_) {
        return {
          signature: candidate.signature,
          provenance: candidate.provenance,
          decodeStatus: "failed" as const,
          error: "Sample calldata does not contain all arguments required by this fixture.",
        };
      }

      return {
        signature: candidate.signature,
        provenance: candidate.provenance,
        decodeStatus: "success" as const,
        arguments: arguments_,
      };
    }),
    warnings: ["Sample fixture only; no live decoding was performed."],
  });
}
