import { describe, expect, it } from "vitest";
import { InvalidInputError, LogInputSchema, type LogInput } from "@atlas/schemas";
import { toEventSelector } from "viem";

import { decodeLog, lookupEvent } from "./events.js";
import { eventRecord, memoryEventRepository } from "./test-fixtures.js";

const TRANSFER = "Transfer(address,address,uint256)";
const TRANSFER_TOPIC = toEventSelector(TRANSFER);
const FROM = "0x0000000000000000000000000000000000000001";
const TO = "0x000000000000000000000000000000000000dEaD";

function padded(address: string): `0x${string}` {
  return `0x${"0".repeat(24)}${address.slice(2).toLowerCase()}`;
}

function makeLog(topics: string[], data: string): LogInput {
  return LogInputSchema.parse({ topics, data });
}

function transferLog(value: bigint): LogInput {
  return makeLog(
    [TRANSFER_TOPIC, padded(FROM), padded(TO)],
    `0x${value.toString(16).padStart(64, "0")}`,
  );
}

describe("event lookup", () => {
  it("returns every candidate for a topic0", async () => {
    const repository = memoryEventRepository([
      eventRecord(TRANSFER, TRANSFER_TOPIC, "a", [true, true, false]),
    ]);

    const result = await lookupEvent(repository, TRANSFER_TOPIC.toUpperCase().replace("0X", "0x"));

    expect(result.identifier).toBe(TRANSFER_TOPIC);
    expect(result.kind).toBe("event");
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0]).toMatchObject({ signature: TRANSFER });
  });

  it("returns a valid empty result for an unknown topic0", async () => {
    const result = await lookupEvent(memoryEventRepository([]), `0x${"1".repeat(64)}`);

    expect(result.candidates).toEqual([]);
    expect(result.ambiguous).toBe(false);
  });

  it("rejects a malformed topic0", async () => {
    await expect(lookupEvent(memoryEventRepository([]), "0x1234")).rejects.toBeInstanceOf(
      InvalidInputError,
    );
    await expect(lookupEvent(memoryEventRepository([]), "0x1234")).rejects.toMatchObject({
      code: "INVALID_TOPIC0",
    });
  });
});

describe("log decoding", () => {
  it("decodes indexed parameters using the pinned layout", async () => {
    const repository = memoryEventRepository([
      eventRecord(TRANSFER, TRANSFER_TOPIC, "a", [true, true, false]),
    ]);

    const result = await decodeLog(repository, transferLog(1_000_000n));

    expect(result.ambiguous).toBe(false);
    expect(result.decoded).toHaveLength(1);
    expect(result.decoded[0]).toMatchObject({
      signature: TRANSFER,
      decodeStatus: "success",
      arguments: [
        { name: "arg0", type: "address", value: FROM.toLowerCase() },
        { name: "arg1", type: "address", value: TO.toLowerCase() },
        { name: "arg2", type: "uint256", value: "1000000" },
      ],
    });
  });

  it("refuses to guess when the layout is not pinned and several layouts match", async () => {
    const repository = memoryEventRepository([eventRecord(TRANSFER, TRANSFER_TOPIC, "a")]);

    const result = await decodeLog(repository, transferLog(1_000_000n));

    expect(result.decoded[0]).toMatchObject({ decodeStatus: "failed" });
    expect(result.decoded[0]).toHaveProperty("error");
    expect((result.decoded[0] as { error: string }).error).toMatch(/will not guess/);
  });

  it("decodes when only one layout is possible", async () => {
    const ping = "Ping(uint256)";
    const topic = toEventSelector(ping);
    const repository = memoryEventRepository([eventRecord(ping, topic, "b", [false])]);

    const result = await decodeLog(
      repository,
      makeLog([topic], `0x${42n.toString(16).padStart(64, "0")}`),
    );

    expect(result.decoded[0]).toMatchObject({
      decodeStatus: "success",
      arguments: [{ name: "arg0", type: "uint256", value: "42" }],
    });
  });

  it("returns a valid empty decode for an unknown topic0", async () => {
    const result = await decodeLog(
      memoryEventRepository([]),
      makeLog([`0x${"2".repeat(64)}`], "0x"),
    );

    expect(result.decoded).toEqual([]);
    expect(result.warnings[0]).toMatch(/No canonical event signature/);
  });

  it("rejects a log without topic0 and malformed data", async () => {
    const repository = memoryEventRepository([]);

    await expect(decodeLog(repository, { topics: [], data: "0x" } as never)).rejects.toBeInstanceOf(
      InvalidInputError,
    );
    await expect(
      decodeLog(repository, { topics: [TRANSFER_TOPIC], data: "not-hex" } as never),
    ).rejects.toBeInstanceOf(InvalidInputError);
  });

  it("reports per-candidate failures when the data does not match", async () => {
    const repository = memoryEventRepository([
      eventRecord(TRANSFER, TRANSFER_TOPIC, "a", [true, true, false]),
    ]);

    const result = await decodeLog(
      repository,
      makeLog([TRANSFER_TOPIC, padded(FROM), padded(TO)], "0x"),
    );

    expect(result.decoded[0]).toMatchObject({ decodeStatus: "failed" });
  });
});
