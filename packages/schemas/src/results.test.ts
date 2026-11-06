import { describe, expect, it } from "vitest";
import { ApiErrorSchema, InvalidInputError, presentAtlasError, toApiError } from "./errors.js";
import { FunctionLookupResultSchema, LogInputSchema } from "./results.js";

const timestamp = "2026-11-05T10:00:00Z";

describe("result and error contracts", () => {
  it("validates an empty lookup as an unambiguous successful result", () => {
    expect(
      FunctionLookupResultSchema.safeParse({
        identifier: "0xa9059cbb",
        kind: "function",
        ambiguous: false,
        candidates: [],
        registry: "arkiv-rabdi",
        warnings: [],
      }).success,
    ).toBe(true);
  });

  it("requires lookup ambiguity to match the number of candidates", () => {
    expect(
      FunctionLookupResultSchema.safeParse({
        identifier: "0xa9059cbb",
        kind: "function",
        ambiguous: false,
        candidates: [
          {
            signature: "transfer(address,uint256)",
            source: "ethereum-lists/4bytes",
            sourceId: "12345",
            entityKey: "entity-1",
            provenance: {
              datasetVersion: "snapshot-1",
              importedAt: timestamp,
              recordHash: `0x${"1".repeat(64)}`,
            },
          },
          {
            signature: "transfer(bytes32,uint256)",
            source: "ethereum-lists/4bytes",
            sourceId: "67890",
            entityKey: "entity-2",
            provenance: {
              datasetVersion: "snapshot-1",
              importedAt: timestamp,
              recordHash: `0x${"2".repeat(64)}`,
            },
          },
        ],
        registry: "arkiv-rabdi",
        warnings: [],
      }).success,
    ).toBe(false);
  });

  it("validates log input topic and data boundaries", () => {
    expect(
      LogInputSchema.safeParse({
        topics: [`0x${"a".repeat(64)}`],
        data: "0xaabb",
      }).success,
    ).toBe(true);
    expect(LogInputSchema.safeParse({ topics: [], data: "0x" }).success).toBe(false);
  });

  it("maps domain errors consistently to API and CLI", () => {
    const error = new InvalidInputError(
      "Expected a 4-byte hexadecimal selector.",
      "INVALID_SELECTOR",
    );
    expect(presentAtlasError(error)).toEqual({ httpStatus: 400, cliExitCode: 2 });
    expect(ApiErrorSchema.parse(toApiError(error, "req_123")).error).toMatchObject({
      code: "INVALID_SELECTOR",
      requestId: "req_123",
    });
  });
});
