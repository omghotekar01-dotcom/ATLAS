import { describe, expect, it } from "vitest";
import {
  canonicalJson,
  hashCanonicalValue,
  hashEventSignature,
  hashFunctionSignature,
} from "./hash.js";

describe("canonical serialization and record hashes", () => {
  it("sorts object keys and preserves array order", () => {
    expect(canonicalJson({ z: [2, 1], a: true })).toBe('{"a":true,"z":[2,1]}');
  });

  it("rejects values JSON cannot represent deterministically", () => {
    expect(() => canonicalJson({ value: undefined })).toThrow("does not support undefined");
    expect(() => canonicalJson(Number.POSITIVE_INFINITY)).toThrow("non-finite numbers");
    const circular: { self?: unknown } = {};
    circular.self = circular;
    expect(() => canonicalJson(circular)).toThrow("circular references");
    expect(canonicalJson({ ["__proto__"]: "preserved" })).toBe('{"__proto__":"preserved"}');
  });

  it("produces a stable hash for equivalent object key orderings", async () => {
    await expect(hashCanonicalValue({ b: 2, a: 1 })).resolves.toBe(
      await hashCanonicalValue({ a: 1, b: 2 }),
    );
  });

  it("hashes normalized source identity and content, not import metadata", async () => {
    const input = {
      selector: "0xA9059CBB",
      signature: "transfer ( address , uint256 )",
      source: "ethereum-lists/4bytes",
      sourceId: "12345",
    };

    const first = await hashFunctionSignature(input);
    const sameRecord = await hashFunctionSignature({
      ...input,
      selector: "0xa9059cbb",
      signature: "transfer(address,uint256)",
    });
    const changedRecord = await hashFunctionSignature({ ...input, sourceId: "67890" });

    expect(first).toMatch(/^0x[0-9a-f]{64}$/);
    expect(first).toBe(sameRecord);
    expect(first).not.toBe(changedRecord);
  });

  it("hashes normalized event source identity and content", async () => {
    const input = {
      topic0: `0x${"A".repeat(64)}`,
      signature: "Transfer ( address , address , uint256 )",
      source: "verified-event-source",
      sourceId: "event-123",
    };

    await expect(hashEventSignature(input)).resolves.toBe(
      await hashEventSignature({
        ...input,
        topic0: input.topic0.toLowerCase(),
        signature: "Transfer(address,address,uint256)",
      }),
    );
  });
});
