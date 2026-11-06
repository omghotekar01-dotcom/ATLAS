import {
  CalldataDecodeResultSchema,
  InvalidInputError,
  normalizeHexData,
  type CalldataDecodeResult,
  type DecodedArgument,
  type FunctionDecodeAttempt,
  type JsonValue,
  type SignatureCandidate,
} from "@atlas/schemas";
import {
  decodeFunctionData,
  encodeFunctionData,
  parseAbiItem,
  type AbiFunction,
  type AbiParameter,
  type Hex,
} from "viem";

import { lookupFunction, parseSelectorInput } from "./resolver.js";
import type { FunctionSignatureRepository } from "./types.js";

/** Converts viem's decoded values into JSON-safe values; bigints become decimal strings. */
export function serializeDecodedValue(value: unknown): JsonValue {
  if (typeof value === "bigint") return value.toString(10);
  if (value === null || value === undefined) return null;
  if (typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (Array.isArray(value)) return value.map(serializeDecodedValue);
  if (value instanceof Uint8Array) {
    return `0x${Array.from(value, (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
  }
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, entry]) => entry !== undefined)
      .sort(([left], [right]) => left.localeCompare(right));
    return Object.fromEntries(entries.map(([key, entry]) => [key, serializeDecodedValue(entry)]));
  }
  return String(value);
}

function inputName(input: AbiParameter, index: number): string {
  return input.name && input.name.length > 0 ? input.name : `arg${index}`;
}

/**
 * Serializes a decoded value using its ABI parameter type. Addresses are
 * lowercased for a stable API surface; tuples and arrays recurse.
 */
export function serializeArgument(input: AbiParameter, value: unknown): JsonValue {
  if (input.type.endsWith("]") && Array.isArray(value)) {
    const inner = {
      ...input,
      type: input.type.slice(0, input.type.lastIndexOf("[")),
    } as AbiParameter;
    return value.map((entry) => serializeArgument(inner, entry));
  }

  const components = (input as AbiParameter & { components?: readonly AbiParameter[] }).components;
  if (input.type.startsWith("tuple") && components) {
    return components.reduce<Record<string, JsonValue>>((accumulator, component, index) => {
      const name = inputName(component, index);
      const entry =
        value && typeof value === "object" && !Array.isArray(value)
          ? (value as Record<string, unknown>)[name]
          : Array.isArray(value)
            ? value[index]
            : undefined;
      accumulator[name] = serializeArgument(component, entry);
      return accumulator;
    }, {});
  }

  if (input.type === "address" && typeof value === "string") {
    return value.toLowerCase();
  }

  return serializeDecodedValue(value);
}

function toArguments(inputs: readonly AbiParameter[], args: unknown): DecodedArgument[] {
  if (Array.isArray(args)) {
    return inputs.map((input, index) => ({
      name: inputName(input, index),
      type: input.type,
      value: serializeArgument(input, args[index]),
    }));
  }

  if (args && typeof args === "object") {
    return inputs.map((input, index) => {
      const name = inputName(input, index);
      return {
        name,
        type: input.type,
        value: serializeArgument(input, (args as Record<string, unknown>)[name]),
      };
    });
  }

  return [];
}

export function decodeFunctionCandidate(
  candidate: SignatureCandidate,
  calldata: Hex,
): DecodedArgument[] {
  const item = parseAbiItem(`function ${candidate.signature}`);
  if (item.type !== "function") {
    throw new Error(`${candidate.signature} is not a function ABI item.`);
  }

  const { args } = decodeFunctionData({ abi: [item] as AbiFunction[], data: calldata });
  const arguments_ = toArguments(item.inputs, args);

  // A candidate only counts as a match when its own ABI encoding reproduces the
  // calldata byte-for-byte. This rejects signatures that decode only because
  // the decoder ignored trailing bytes.
  const reencoded = encodeFunctionData({
    abi: [item] as AbiFunction[],
    functionName: item.name,
    args: args as readonly unknown[],
  });
  if (reencoded.toLowerCase() !== calldata.toLowerCase()) {
    throw new Error(
      `Calldata does not round-trip through ${candidate.signature}; trailing or malformed bytes are present.`,
    );
  }

  return arguments_;
}

/**
 * Decodes calldata against every canonical candidate for the embedded selector.
 * Each candidate succeeds or fails independently; results are never merged.
 */
export async function decodeCalldata(
  repository: FunctionSignatureRepository,
  calldataInput: string,
): Promise<CalldataDecodeResult> {
  const calldata = (() => {
    try {
      return normalizeHexData(calldataInput);
    } catch {
      throw new InvalidInputError("calldata must be 0x-prefixed hexadecimal bytes.");
    }
  })();
  if (calldata.length < 10) {
    throw new InvalidInputError("Calldata must contain a 4-byte selector.");
  }

  const selector = parseSelectorInput(calldata.slice(0, 10));
  const lookup = await lookupFunction(repository, selector);

  const decoded: FunctionDecodeAttempt[] = lookup.candidates.map((candidate) => {
    try {
      return {
        signature: candidate.signature,
        provenance: candidate.provenance,
        decodeStatus: "success" as const,
        arguments: decodeFunctionCandidate(candidate, calldata as Hex),
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
      `No canonical signature is mirrored for selector ${selector}. ATLAS cannot decode this calldata.`,
    );
  }
  const failed = decoded.filter((attempt) => attempt.decodeStatus === "failed").length;
  if (failed > 0) {
    warnings.push(
      `${failed} of ${decoded.length} candidate signatures did not decode this calldata; the calldata may be encoded differently or may not belong to that candidate.`,
    );
  }

  return CalldataDecodeResultSchema.parse({
    selector,
    ambiguous: lookup.candidates.length > 1,
    decoded,
    warnings,
  });
}
