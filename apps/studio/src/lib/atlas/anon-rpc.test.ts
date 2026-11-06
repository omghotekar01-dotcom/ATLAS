import { describe, expect, it, vi } from "vitest";
import { assertPublicRpcUrl, NYM_MAINNET_SPECIFIER } from "./anon-rpc";

describe("Anon-RPC browser-only guardrails", () => {
  it("does not accept plaintext or credential-bearing direct bootstrap endpoints", () => {
    expect(() => assertPublicRpcUrl("http://rpc.example")).toThrow();
    expect(() => assertPublicRpcUrl("https://user:password@rpc.example")).toThrow();
    expect(() => assertPublicRpcUrl("not-a-url")).toThrow();
  });
  it("accepts a public HTTPS endpoint and pins the Nym specifier", () => {
    expect(assertPublicRpcUrl("https://rpc.example")).toBe("https://rpc.example/");
    expect(NYM_MAINNET_SPECIFIER).toMatch(/^0x[0-9a-f]{40}$/i);
  });
});

it("closes a failing Nym worker without falling back to direct fetch", async () => {
  const close = vi.fn();
  const fetchThroughWorker = vi.fn().mockRejectedValue(new Error("Nym offline"));
  vi.doMock("@anon-rpc/browser-harness", () => ({
    AnonRpcWorker: class {
      ready = Promise.resolve();
      fetch = fetchThroughWorker;
      close = close;
    },
  }));
  const directFetch = vi.spyOn(globalThis, "fetch");
  try {
    const { anonymousTransaction } = await import("./anon-rpc");
    await expect(
      anonymousTransaction(
        "https://bootstrap.example",
        "https://target.example",
        1,
        `0x${"a".repeat(64)}`,
      ),
    ).rejects.toThrow("Nym offline");
    expect(fetchThroughWorker).toHaveBeenCalledTimes(1);
    expect(directFetch).not.toHaveBeenCalled();
    expect(close).toHaveBeenCalledOnce();
  } finally {
    directFetch.mockRestore();
    vi.doUnmock("@anon-rpc/browser-harness");
  }
});
