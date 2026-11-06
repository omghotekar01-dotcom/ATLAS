import { describe, expect, it, vi } from "vitest";
import { lookupCommunity } from "./community.js";
const selector = "0xa9059cbb";
const row = (id: number, signature: string, hex_signature = selector) => ({
  id,
  text_signature: signature,
  hex_signature,
});
const fetchResponse = (data: unknown, status = 200) =>
  (async (_input: RequestInfo | URL, _init?: RequestInit) => {
    // The test stub intentionally ignores fetch arguments but keeps the fetch signature.
    void _input;
    void _init;
    return new Response(JSON.stringify(data), {
      status,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;

describe("read-only 4byte.directory community integration", () => {
  it("accepts exact selector candidates without claiming canonical status", async () => {
    const fetcher = vi.fn(
      fetchResponse({
        count: 2,
        next: null,
        results: [row(10, "transfer(address,uint256)"), row(5, "random(uint256)")],
      }),
    );
    const result = await lookupCommunity(selector, { fetcher });
    expect(result.canonical).toBe(false);
    expect(result.registry).toBe("4byte.directory");
    expect(result.candidates.map((x) => x.id)).toEqual([5, 10]);
    expect(result.warnings.join(" ")).toMatch(/Multiple/);
    const url = fetcher.mock.calls[0]?.[0] as URL;
    expect(url.hostname).toBe("www.4byte.directory");
    expect(url.searchParams.get("hex_signature")).toBe(selector);
  });
  it("fails closed on invalid selectors before making a network request", async () => {
    const fetcher = vi.fn(fetchResponse({ count: 0, next: null, results: [] }));
    await expect(lookupCommunity("0xabc", { fetcher })).rejects.toMatchObject({
      code: "INVALID_SELECTOR",
    });
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("treats bad upstream responses as unavailable rather than empty", async () => {
    await expect(
      lookupCommunity(selector, { fetcher: fetchResponse({ bad: true }) }),
    ).rejects.toMatchObject({ code: "UPSTREAM_UNAVAILABLE" });
    await expect(
      lookupCommunity(selector, { fetcher: fetchResponse({}, 429) }),
    ).rejects.toMatchObject({ code: "UPSTREAM_UNAVAILABLE" });
  });
  it("discards mismatched results and marks incomplete pages as truncated", async () => {
    const result = await lookupCommunity(selector, {
      fetcher: fetchResponse({
        count: 3,
        next: "/api/v1/signatures/?page=2",
        results: [row(1, "transfer(address,uint256)"), row(2, "malicious()", "0xdeadbeef")],
      }),
    });
    expect(result.candidates).toHaveLength(1);
    expect(result.truncated).toBe(true);
    expect(result.warnings.join(" ")).toMatch(/discarded/);
  });
  it("does not silently skip unverified network errors", async () => {
    await expect(
      lookupCommunity(selector, {
        fetcher: (async () => {
          throw Error("offline");
        }) as typeof fetch,
      }),
    ).rejects.toMatchObject({ code: "UPSTREAM_UNAVAILABLE" });
  });
});
