import { HashSchema, type Hash } from "./primitives.js";
import { EventSignatureSchema, FunctionSignatureSchema } from "./records.js";

type CanonicalValue =
  null | boolean | number | string | CanonicalValue[] | { [key: string]: CanonicalValue };

function canonicalize(value: unknown, seen: WeakSet<object>): CanonicalValue {
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new TypeError("Canonical JSON does not support non-finite numbers.");
    }

    return value;
  }

  if (typeof value !== "object") {
    throw new TypeError(`Canonical JSON does not support ${typeof value}.`);
  }

  if (seen.has(value)) {
    throw new TypeError("Canonical JSON does not support circular references.");
  }

  seen.add(value);

  try {
    if (Array.isArray(value)) {
      return Array.from(value, (item) => canonicalize(item, seen));
    }

    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new TypeError("Canonical JSON only supports plain objects.");
    }

    const record = value as Record<string, unknown>;
    const sorted = Object.create(null) as Record<string, CanonicalValue>;
    for (const key of Object.keys(record).sort()) {
      sorted[key] = canonicalize(record[key], seen);
    }
    return sorted;
  } finally {
    seen.delete(value);
  }
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalize(value, new WeakSet()));
}

export async function hashCanonicalValue(value: unknown): Promise<Hash> {
  const bytes = new TextEncoder().encode(canonicalJson(value));
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  const hex = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
  return HashSchema.parse(`0x${hex}`);
}

export interface FunctionSignatureHashInput {
  selector: string;
  signature: string;
  source: string;
  sourceId: string;
  sourceUpdatedAt?: string;
}

export async function hashFunctionSignature(input: FunctionSignatureHashInput): Promise<Hash> {
  const normalized = FunctionSignatureSchema.pick({
    selector: true,
    signature: true,
    source: true,
    sourceId: true,
    sourceUpdatedAt: true,
  }).parse(input);

  return hashCanonicalValue({
    selector: normalized.selector,
    signature: normalized.signature,
    source: normalized.source,
    sourceId: normalized.sourceId,
    sourceUpdatedAt: normalized.sourceUpdatedAt ?? null,
  });
}

export interface EventSignatureHashInput {
  topic0: string;
  signature: string;
  source: string;
  sourceId: string;
}

export async function hashEventSignature(input: EventSignatureHashInput): Promise<Hash> {
  const normalized = EventSignatureSchema.pick({
    topic0: true,
    signature: true,
    source: true,
    sourceId: true,
  }).parse(input);

  return hashCanonicalValue({
    topic0: normalized.topic0,
    signature: normalized.signature,
    source: normalized.source,
    sourceId: normalized.sourceId,
  });
}
