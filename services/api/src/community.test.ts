import { describe, expect, it } from "vitest";
import { createApp } from "./app-factory.js";
import { CommunityLookupResultSchema } from "@atlas/schemas";
const selector = "0xa9059cbb";

describe("opt-in community signature API", () => {
  it("returns read-only unverified community suggestions", async () => {
    let calls = 0;
    const app = createApp({
      communityLookup: async (input) => {
        calls++;
        expect(input).toBe(selector);
        return CommunityLookupResultSchema.parse({
          selector,
          registry: "4byte.directory",
          canonical: false,
          candidates: [{ id: 7, selector, signature: "transfer(address,uint256)" }],
          total: 1,
          truncated: false,
          warnings: ["Unverified"],
        });
      },
    });
    try {
      const response = await app.inject({ method: "GET", url: `/v1/community/4byte/${selector}` });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({ canonical: false, candidates: [{ id: 7 }] });
      expect(calls).toBe(1);
    } finally {
      await app.close();
    }
  });
  it("rejects bad selectors before contacting community service", async () => {
    let calls = 0;
    const app = createApp({
      communityLookup: async () => {
        calls++;
        throw Error("should not call");
      },
    });
    try {
      const response = await app.inject({ method: "GET", url: "/v1/community/4byte/0xabc" });
      expect(response.statusCode).toBe(400);
      expect(calls).toBe(0);
    } finally {
      await app.close();
    }
  });
});
