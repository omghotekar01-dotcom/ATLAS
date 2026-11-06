import { describe, expect, it } from "vitest";
import { analyzeCalldata, classifyQuery } from "./hex";

describe("hex rules", () => {
  it("accepts exactly 4-byte selectors", () => {
    expect(classifyQuery("0xA9059CBB")).toEqual({ kind: "selector", value: "0xa9059cbb" });
    expect(classifyQuery("0xa9059c").kind).toBe("partial-hex");
  });
  it("recognises signatures", () => {
    expect(classifyQuery("transfer(address, uint256)").kind).toBe("signature");
  });
  it("extracts selector and 32-byte words from calldata", () => {
    const r = analyzeCalldata("0xa9059cbb" + "00".repeat(64));
    expect(r.ok && r.selector).toBe("0xa9059cbb");
    expect(r.ok && r.words.length).toBe(2);
    expect(analyzeCalldata("0xabc").ok).toBe(false);
  });
});
