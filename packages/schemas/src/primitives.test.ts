import { describe, expect, it } from "vitest";
import {
  AddressSchema,
  ChainIdSchema,
  HexDataSchema,
  SelectorSchema,
  SignatureSchema,
  TimestampSchema,
  Topic0Schema,
  normalizeAddress,
  normalizeSelector,
  normalizeSignature,
  normalizeTopic0,
} from "./primitives.js";

describe("Ethereum primitive schemas", () => {
  it("normalizes selectors and rejects anything other than four bytes", () => {
    expect(normalizeSelector("  0XA9059CBB ")).toBe("0xa9059cbb");
    expect(SelectorSchema.safeParse("0xa9059cb").success).toBe(false);
    expect(SelectorSchema.safeParse("transfer").success).toBe(false);
  });

  it("normalizes topic0 hashes and validates the exact byte length", () => {
    const topic = `0x${"A".repeat(64)}`;
    expect(normalizeTopic0(topic)).toBe(`0x${"a".repeat(64)}`);
    expect(Topic0Schema.safeParse("0x1234").success).toBe(false);
  });

  it("normalizes addresses and rejects invalid hex", () => {
    const address = `0x${"B".repeat(40)}`;
    expect(normalizeAddress(address)).toBe(`0x${"b".repeat(40)}`);
    expect(AddressSchema.safeParse(`0x${"g".repeat(40)}`).success).toBe(false);
  });

  it("accepts only whole-byte hex data", () => {
    expect(HexDataSchema.parse("0xAABB")).toBe("0xaabb");
    expect(HexDataSchema.safeParse("0xabc").success).toBe(false);
  });

  it("normalizes signature spacing without changing names or types", () => {
    expect(normalizeSignature(" transfer ( address , uint256 ) ")).toBe(
      "transfer(address,uint256)",
    );
    expect(SignatureSchema.parse("approve(address spender, uint256 amount)")).toBe(
      "approve(address spender,uint256 amount)",
    );
  });

  it("validates chain IDs and ISO timestamps", () => {
    expect(ChainIdSchema.safeParse(1).success).toBe(true);
    expect(ChainIdSchema.safeParse(0).success).toBe(false);
    expect(TimestampSchema.safeParse("2026-11-05T10:00:00Z").success).toBe(true);
    expect(TimestampSchema.safeParse("not-a-date").success).toBe(false);
  });
});
