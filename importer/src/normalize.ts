/**
 * Turns raw extraction drafts into validated shared-domain records.
 *
 * Every draft is re-validated against `viem` before it can become a record:
 * the signature is canonicalized, parsed as an ABI item, and its selector or
 * topic0 is recomputed and compared with the supplied value. A mismatch is
 * rejected, never repaired silently. This is what makes externally supplied or
 * corrupted source records safe to ingest.
 *
 * Identity rules:
 * - The deterministic `recordHash` comes from `@atlas/schemas` and covers the
 *   normalized identifier, signature and upstream source identity only. Import
 *   timestamps and dataset versions are excluded so re-running an import of an
 *   unchanged source snapshot produces the same hashes.
 * - Identical declarations of the same signature across files are collapsed to
 *   the lexicographically smallest source ID. Different signatures that share a
 *   selector/topic are never collapsed (collisions are first-class data).
 */
import {
  EventSignatureSchema,
  FunctionSignatureSchema,
  hashEventSignature,
  hashFunctionSignature,
  type EventSignature,
  type FunctionSignature,
} from "@atlas/schemas";
import { parseAbiItem, toEventSelector, toFunctionSelector } from "viem";

import type { EventDraft, FunctionDraft, SignatureDraft } from "./solidity.js";

export interface RecordBuildOptions {
  /** Import snapshot identifier, e.g. a date plus source commit. */
  readonly datasetVersion: string;
  /** ISO timestamp recorded on every record. */
  readonly importedAt: string;
}

export interface DraftRejection {
  readonly kind: "function" | "event";
  /** The supplied (or partially canonicalized) signature. */
  readonly signature: string;
  readonly sourceId: string;
  readonly reason: string;
}

export interface BuiltRecords {
  readonly functions: FunctionSignature[];
  readonly events: EventSignature[];
  /** Duplicate declarations collapsed because identifier + signature matched. */
  readonly duplicates: number;
  readonly rejections: DraftRejection[];
}

type Canonical =
  { ok: true; signature: string; identifier: string } | { ok: false; reason: string };

/**
 * Canonicalizes whitespace and validates the ABI item. Returns the recomputed
 * selector/topic0 so callers can detect a mismatch against supplied values.
 */
export function canonicalSignature(raw: string, kind: "function" | "event"): Canonical {
  const trimmed = raw.trim().replace(/^(function|event)\s+/, "");
  const signature = trimmed.replace(/\s+/g, "");

  if (!signature) return { ok: false, reason: "signature is empty" };
  if (!/^[A-Za-z_$][A-Za-z0-9_$]*\(/.test(signature)) {
    return {
      ok: false,
      reason: "signature must start with an identifier and an opening parenthesis",
    };
  }

  try {
    parseAbiItem(`${kind} ${signature}`);
  } catch (error) {
    return {
      ok: false,
      reason: `invalid ABI ${kind}: ${error instanceof Error ? error.message.split("\n")[0] : "parse failure"}`,
    };
  }

  try {
    const identifier =
      kind === "function"
        ? toFunctionSelector(`function ${signature}`)
        : toEventSelector(`event ${signature}`);
    return { ok: true, signature, identifier };
  } catch (error) {
    return {
      ok: false,
      reason: `${kind === "function" ? "selector" : "topic0"} computation failed: ${
        error instanceof Error ? error.message : "unknown error"
      }`,
    };
  }
}

function validateFunctionDraft(draft: FunctionDraft): FunctionDraft | DraftRejection {
  const canonical = canonicalSignature(draft.signature, "function");
  if (!canonical.ok) {
    return {
      kind: "function",
      signature: draft.signature,
      sourceId: draft.sourceId,
      reason: canonical.reason,
    };
  }
  if (canonical.identifier.toLowerCase() !== draft.selector.toLowerCase()) {
    return {
      kind: "function",
      signature: canonical.signature,
      sourceId: draft.sourceId,
      reason: `selector mismatch: signature computes ${canonical.identifier}, source supplied ${draft.selector}`,
    };
  }
  return { ...draft, signature: canonical.signature, selector: canonical.identifier };
}

function validateEventDraft(draft: EventDraft): EventDraft | DraftRejection {
  const canonical = canonicalSignature(draft.signature, "event");
  if (!canonical.ok) {
    return {
      kind: "event",
      signature: draft.signature,
      sourceId: draft.sourceId,
      reason: canonical.reason,
    };
  }
  if (canonical.identifier.toLowerCase() !== draft.topic0.toLowerCase()) {
    return {
      kind: "event",
      signature: canonical.signature,
      sourceId: draft.sourceId,
      reason: `topic0 mismatch: signature computes ${canonical.identifier}, source supplied ${draft.topic0}`,
    };
  }
  return { ...draft, signature: canonical.signature, topic0: canonical.identifier };
}

function isRejection(value: FunctionDraft | EventDraft | DraftRejection): value is DraftRejection {
  return "reason" in value;
}

function chooseCanonicalDraft<T extends SignatureDraft>(drafts: readonly T[]): T {
  return [...drafts].sort((left, right) => left.sourceId.localeCompare(right.sourceId))[0]!;
}

function groupDrafts<T extends SignatureDraft>(
  drafts: readonly T[],
  identifier: (draft: T) => string,
): T[] {
  const groups = new Map<string, T[]>();
  for (const draft of drafts) {
    const key = `${identifier(draft)}\u0000${draft.signature}`;
    const group = groups.get(key);
    if (group) group.push(draft);
    else groups.set(key, [draft]);
  }
  return [...groups.values()].map(chooseCanonicalDraft);
}

export async function buildRecords(
  drafts: { functions: readonly FunctionDraft[]; events: readonly EventDraft[] },
  options: RecordBuildOptions,
): Promise<BuiltRecords> {
  const rejections: DraftRejection[] = [];

  const validFunctions: FunctionDraft[] = [];
  for (const draft of drafts.functions) {
    const result = validateFunctionDraft(draft);
    if (isRejection(result)) rejections.push(result);
    else validFunctions.push(result);
  }

  const validEvents: EventDraft[] = [];
  for (const draft of drafts.events) {
    const result = validateEventDraft(draft);
    if (isRejection(result)) rejections.push(result);
    else validEvents.push(result);
  }

  const uniqueFunctions = groupDrafts(validFunctions, (draft) => draft.selector);
  const uniqueEvents = groupDrafts(validEvents, (draft) => draft.topic0);

  const functions: FunctionSignature[] = [];
  for (const draft of uniqueFunctions) {
    const recordHash = await hashFunctionSignature({
      selector: draft.selector,
      signature: draft.signature,
      source: draft.source,
      sourceId: draft.sourceId,
    });
    functions.push(
      FunctionSignatureSchema.parse({
        selector: draft.selector,
        signature: draft.signature,
        source: draft.source,
        sourceId: draft.sourceId,
        importedAt: options.importedAt,
        datasetVersion: options.datasetVersion,
        recordHash,
      }),
    );
  }

  const events: EventSignature[] = [];
  for (const draft of uniqueEvents) {
    const recordHash = await hashEventSignature({
      topic0: draft.topic0,
      signature: draft.signature,
      source: draft.source,
      sourceId: draft.sourceId,
    });
    events.push(
      EventSignatureSchema.parse({
        topic0: draft.topic0,
        signature: draft.signature,
        source: draft.source,
        sourceId: draft.sourceId,
        importedAt: options.importedAt,
        datasetVersion: options.datasetVersion,
        recordHash,
      }),
    );
  }

  functions.sort((left, right) => left.recordHash.localeCompare(right.recordHash));
  events.sort((left, right) => left.recordHash.localeCompare(right.recordHash));

  const duplicates =
    validFunctions.length - uniqueFunctions.length + (validEvents.length - uniqueEvents.length);

  return { functions, events, duplicates, rejections };
}
