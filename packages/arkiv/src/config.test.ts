import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createArkivPublicClient,
  createArkivWalletClient,
  readArkivEnvironment,
} from "./config.js";
import { FunctionSignatures } from "./schema.js";

describe("Arkiv configuration", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("requires an explicit Rabdi access key", () => {
    expect(() => readArkivEnvironment({})).toThrow("ARKIV_ACCESS_KEY is required");
  });

  it("validates private keys without exposing them in errors", () => {
    expect(() =>
      readArkivEnvironment({ ARKIV_ACCESS_KEY: "access-key", ARKIV_PRIVATE_KEY: "secret" }),
    ).toThrow("32-byte hexadecimal private key");
  });

  it("creates a read-only client with only an access key", () => {
    const env = readArkivEnvironment({ ARKIV_ACCESS_KEY: "local-key" });
    expect(env).toEqual({ accessKey: "local-key" });
    expect(createArkivPublicClient(env.accessKey).chain?.id).toBe(7794095);
    expect(() => createArkivWalletClient(env)).toThrow("ARKIV_PRIVATE_KEY is required");
  });

  it("requires a signing key before it can create a write client", () => {
    const client = createArkivWalletClient({
      accessKey: "local-key",
      privateKey: `0x${"1".repeat(64)}`,
    });
    expect(client.chain?.id).toBe(7794095);
    expect(client.account?.address).toMatch(/^0x[0-9a-f]{40}$/i);
  });

  it("declares indexed fields used by selector/provenance queries", () => {
    expect(FunctionSignatures.name).toBe("atlas.function-signatures");
    expect(FunctionSignatures.columns.selector.isIndexed).toBe(true);
    expect(FunctionSignatures.columns.signature.type).toBe("bytes");
    expect(FunctionSignatures.columns.signature.isIndexed).toBe(false);
    expect(FunctionSignatures.columns.source.isIndexed).toBe(true);
    expect(FunctionSignatures.columns.recordHash.isIndexed).toBe(true);
  });
});
