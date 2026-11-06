import { describe, expect, it } from "vitest";
import { sampleDecode, sampleLookup } from "./fixtures.js";

describe("explicit sample preview fixtures", () => {
  it("returns clearly labeled selector candidates including collisions", () => {
    const result = sampleLookup("0xa9059cbb");

    expect("candidates" in result).toBe(true);
    if ("candidates" in result) {
      expect(result.ambiguous).toBe(true);
      expect(result.candidates).toHaveLength(2);
      expect(result.registry).toBe("sample-preview");
      expect(result.warnings[0]).toContain("not a live");
      expect(result.candidates.every((candidate) => candidate.source === "sample-preview")).toBe(
        true,
      );
    }
  });

  it("decodes sample calldata words without presenting fixtures as live results", () => {
    const result = sampleDecode("0xa9059cbb", [
      "000000000000000000000000d8da6bf26964af9d7eed9e03e53415d37aa96045",
      "0000000000000000000000000000000000000000000000000de0b6b3a7640000",
    ]);

    expect(result.ambiguous).toBe(true);
    expect(result.warnings[0]).toContain("Sample fixture only");
    expect(result.decoded[0]).toMatchObject({
      decodeStatus: "success",
      signature: "transfer(address,uint256)",
      arguments: [
        { name: "to", value: "0xd8da6bf26964af9d7eed9e03e53415d37aa96045" },
        { name: "amount", value: "1000000000000000000" },
      ],
    });
  });
});
