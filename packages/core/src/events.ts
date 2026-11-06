import {
  EventLookupResultSchema,
  InvalidInputError,
  LogDecodeResultSchema,
  LogInputSchema,
  normalizeTopic0,
  UpstreamUnavailableError,
  type DecodedArgument,
  type EventDecodeAttempt,
  type EventLookupResult,
  type LogDecodeResult,
  type LogInput,
  type Topic0,
} from "@atlas/schemas";
import { decodeEventLog, parseAbiItem, type AbiEvent, type Hex } from "viem";

import { toCandidate } from "./resolver.js";
import { serializeArgument } from "./decode.js";
import type { CanonicalEventRecord, EventSignatureRepository } from "./types.js";

export function parseTopicInput(input: string): Topic0 {
  try {
    return normalizeTopic0(input);
  } catch {
    throw new InvalidInputError(
      `"${input}" is not an event topic: expected 0x followed by 64 hex characters.`,
      "INVALID_TOPIC0",
    );
  }
}

async function fetchRecords(
  repository: EventSignatureRepository,
  topic0: Topic0,
): Promise<readonly CanonicalEventRecord[]> {
  try {
    return await repository.findByTopic0(topic0);
  } catch (error) {
    throw new UpstreamUnavailableError(
      "The event signature registry could not be queried.",
      { topic0 },
      { cause: error },
    );
  }
}

function buildLookup(records: readonly CanonicalEventRecord[], topic0: Topic0): EventLookupResult {
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
      `Topic ${topic0} has ${candidates.length} canonical event signatures. ATLAS does not rank them as more or less likely.`,
    );
  }

  return EventLookupResultSchema.parse({
    identifier: topic0,
    kind: "event",
    ambiguous: candidates.length > 1,
    candidates,
    registry: "arkiv-rabdi",
    warnings,
  });
}

export async function lookupEvent(
  repository: EventSignatureRepository,
  topicInput: string,
): Promise<EventLookupResult> {
  const topic0 = parseTopicInput(topicInput);
  const records = await fetchRecords(repository, topic0);
  return buildLookup(records, topic0);
}

function cloneInputs(item: AbiEvent, indexed: readonly boolean[]): AbiEvent {
  if (indexed.length !== item.inputs.length) {
    throw new Error(
      `Event ${item.name} declares ${item.inputs.length} parameters but the mirrored record pins ${indexed.length} indexed flags.`,
    );
  }
  const indexedCount = indexed.filter(Boolean).length;
  if (indexedCount > 3) {
    throw new Error(
      `Event ${item.name} declares ${indexedCount} indexed parameters; the EVM allows at most 3.`,
    );
  }
  return {
    ...item,
    inputs: item.inputs.map((input, position) => ({
      ...input,
      indexed: indexed[position] ?? false,
    })) as AbiEvent["inputs"],
  };
}

function attemptDecode(item: AbiEvent, log: LogInput): DecodedArgument[] {
  const result = decodeEventLog({
    abi: [item] as AbiEvent[],
    topics: log.topics as unknown as [Hex, ...Hex[]],
    data: log.data as Hex,
  });

  return item.inputs.map((input, index) => {
    const name = input.name && input.name.length > 0 ? input.name : `arg${index}`;
    const args = result.args;
    const value =
      args && typeof args === "object" && !Array.isArray(args)
        ? (args as Record<string, unknown>)[name]
        : Array.isArray(args)
          ? args[index]
          : undefined;
    return {
      name,
      type: input.type,
      value: serializeArgument(input, value),
    };
  });
}

function candidateLayouts(parameterCount: number, topicCount: number): boolean[][] {
  if (topicCount < 0 || topicCount > Math.min(3, parameterCount)) return [];
  const layouts: boolean[][] = [];
  const choose = (position: number, chosen: number): void => {
    if (chosen === topicCount) {
      const layout = Array.from({ length: parameterCount }, () => false);
      for (const index of selected) layout[index] = true;
      layouts.push(layout);
      return;
    }
    for (let index = position; index < parameterCount; index += 1) {
      selected.push(index);
      choose(index + 1, chosen + 1);
      selected.pop();
    }
  };
  const selected: number[] = [];
  choose(0, 0);
  return layouts;
}

function decodeEventCandidate(record: CanonicalEventRecord, log: LogInput): DecodedArgument[] {
  const item = parseAbiItem(`event ${record.signature}`);
  if (item.type !== "event") {
    throw new Error(`${record.signature} is not an event ABI item.`);
  }

  if (record.indexed) {
    return attemptDecode(cloneInputs(item, record.indexed), log);
  }

  const topicCount = log.topics.length - 1;
  const layouts = candidateLayouts(item.inputs.length, topicCount);
  if (layouts.length === 0) {
    throw new Error(`Event ${record.signature} cannot carry ${topicCount} indexed topics.`);
  }

  const decoded: { indexed: boolean[]; arguments: DecodedArgument[] }[] = [];
  let lastError: unknown;
  for (const indexed of layouts) {
    try {
      decoded.push({ indexed, arguments: attemptDecode(cloneInputs(item, indexed), log) });
    } catch (error) {
      lastError = error;
    }
  }

  if (decoded.length === 1) return decoded[0]!.arguments;
  if (decoded.length === 0) {
    throw lastError instanceof Error ? lastError : new Error("Decoding failed.");
  }
  throw new Error(
    `This log matches ${decoded.length} indexed layouts for ${record.signature} and the mirrored record does not pin which parameters are indexed. ATLAS will not guess.`,
  );
}

/**
 * Decodes one log against every candidate event signature. A log without a
 * known topic0 yields a valid, empty result rather than an error.
 */
export async function decodeLog(
  repository: EventSignatureRepository,
  log: LogInput,
): Promise<LogDecodeResult> {
  let input: LogInput;
  try {
    input = LogInputSchema.parse(log);
  } catch {
    throw new InvalidInputError(
      "A log must contain 1-4 0x-prefixed 32-byte topics and even-length hexadecimal data.",
    );
  }
  const topic0 = input.topics[0];
  if (!topic0) {
    throw new InvalidInputError("A log must contain at least topic0.", "INVALID_TOPIC0");
  }
  const parsedTopic = parseTopicInput(topic0);
  const records = await fetchRecords(repository, parsedTopic);
  const lookup = buildLookup(records, parsedTopic);
  const byRecordHash = new Map(records.map((record) => [record.recordHash, record]));

  const decoded: EventDecodeAttempt[] = lookup.candidates.map((candidate) => {
    const record = byRecordHash.get(candidate.provenance.recordHash);
    if (!record) {
      return {
        signature: candidate.signature,
        provenance: candidate.provenance,
        decodeStatus: "failed" as const,
        error: "The candidate record disappeared during decoding.",
      };
    }
    try {
      return {
        signature: candidate.signature,
        provenance: candidate.provenance,
        decodeStatus: "success" as const,
        arguments: decodeEventCandidate(record, input),
      };
    } catch (error) {
      return {
        signature: candidate.signature,
        provenance: candidate.provenance,
        decodeStatus: "failed" as const,
        error: error instanceof Error ? error.message : "Decoding failed.",
      };
    }
  });

  const warnings = [...lookup.warnings];
  if (lookup.candidates.length === 0) {
    warnings.push(
      `No canonical event signature is mirrored for topic0 ${parsedTopic}. ATLAS cannot decode this log.`,
    );
  }

  return LogDecodeResultSchema.parse({
    topic0: parsedTopic,
    ambiguous: lookup.candidates.length > 1,
    decoded,
    warnings,
  });
}
