/** Pure helpers for selectors, signatures and calldata. No UI, no network. */

export type QueryKind =
  | { kind: "empty" }
  | { kind: "selector"; value: string }
  | { kind: "signature"; value: string }
  | { kind: "partial-hex"; value: string; message: string }
  | { kind: "text"; value: string };

const SIG_RE = /^[A-Za-z_$][\w$]*\((.*)\)$/;

export function classifyQuery(input: string): QueryKind {
  const v = input.trim();
  if (!v) return { kind: "empty" };
  if (/^0x/i.test(v)) {
    const body = v.slice(2);
    if (!/^[0-9a-f]*$/i.test(body))
      return { kind: "partial-hex", value: v, message: "Contains non-hex characters" };
    if (body.length < 8)
      return { kind: "partial-hex", value: v, message: `${body.length}/8 hex characters` };
    if (body.length > 8)
      return {
        kind: "partial-hex",
        value: v,
        message: "Selectors are exactly 4 bytes — use the Decoder for calldata",
      };
    return { kind: "selector", value: "0x" + body.toLowerCase() };
  }
  if (SIG_RE.test(v.replace(/\s+/g, "")))
    return { kind: "signature", value: v.replace(/\s+/g, "") };
  return { kind: "text", value: v };
}

export type CalldataAnalysis =
  | { ok: false; reason: string; empty?: boolean }
  | {
      ok: true;
      normalized: string;
      byteLength: number;
      selector: string;
      words: string[];
      trailing: string;
    };

export function analyzeCalldata(input: string): CalldataAnalysis {
  const compact = input.replace(/\s+/g, "");
  if (!compact) return { ok: false, reason: "Paste calldata to begin", empty: true };
  if (!/^0x/i.test(compact)) return { ok: false, reason: "Calldata must start with 0x" };
  const body = compact.slice(2);
  const bad = body.search(/[^0-9a-f]/i);
  if (bad !== -1) return { ok: false, reason: `Non-hex character at position ${bad + 2}` };
  if (body.length % 2 !== 0)
    return { ok: false, reason: "Odd number of hex characters (incomplete byte)" };
  if (body.length < 8) return { ok: false, reason: "Need at least 4 bytes for a selector" };
  const lower = body.toLowerCase();
  const args = lower.slice(8);
  const words: string[] = [];
  for (let i = 0; i + 64 <= args.length; i += 64) words.push(args.slice(i, i + 64));
  return {
    ok: true,
    normalized: "0x" + lower,
    byteLength: lower.length / 2,
    selector: "0x" + lower.slice(0, 8),
    words,
    trailing: args.slice(words.length * 64),
  };
}

export function isHex(v: string, bytes?: number): boolean {
  const re = bytes ? new RegExp(`^0x[0-9a-fA-F]{${bytes * 2}}$`) : /^0x([0-9a-fA-F]{2})*$/;
  return re.test(v.trim());
}

export function truncateMiddle(v: string, head = 10, tail = 8) {
  return v.length <= head + tail + 1 ? v : `${v.slice(0, head)}…${v.slice(-tail)}`;
}
