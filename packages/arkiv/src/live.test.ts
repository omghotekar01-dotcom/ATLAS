import { describe, expect, it } from "vitest";
import { normalizeAddress, normalizeSelector } from "@atlas/schemas";

import { createArkivPublicClient } from "./config.js";
import { checkArkivHealth } from "./health.js";
import { ArkivFunctionRepository } from "./repository.js";

/**
 * Live, read-only checks against Rabdi. Disabled unless explicitly enabled:
 *   ATLAS_LIVE_ARKIV=1 ARKIV_ACCESS_KEY=... ATLAS_ARKIV_CREATOR_ADDRESS=0x...
 * These tests never write and never print credentials.
 */
const accessKey = process.env.ARKIV_ACCESS_KEY?.trim();
const creator = process.env.ATLAS_ARKIV_CREATOR_ADDRESS?.trim();
const enabled = process.env.ATLAS_LIVE_ARKIV === "1" && Boolean(accessKey) && Boolean(creator);

describe.skipIf(!enabled)("live Rabdi read-only access", () => {
  it("reports the Rabdi network identity", async () => {
    const client = createArkivPublicClient(accessKey!);
    const health = await checkArkivHealth(client);
    expect(health).toMatchObject({ status: "ok", network: "rabdi", chainId: 7794095 });
  }, 30_000);

  it("queries the canonical registry without writing", async () => {
    const client = createArkivPublicClient(accessKey!);
    const repository = new ArkivFunctionRepository(
      client,
      normalizeAddress(creator!) as `0x${string}`,
    );

    const records = await repository.findBySelector(normalizeSelector("0xa9059cbb"));
    expect(Array.isArray(records)).toBe(true);
    for (const record of records) {
      expect(record.creator.toLowerCase()).toBe(creator!.toLowerCase());
      expect(record.signature.length).toBeGreaterThan(0);
    }
  }, 30_000);
});
