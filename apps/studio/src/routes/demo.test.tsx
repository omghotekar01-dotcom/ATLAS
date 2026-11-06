import { describe, expect, it } from "vitest";
import { evaluateDemoProof } from "./demo";

describe("guided demo never fabricates success", () => {
  it("requires canonical Arkiv ABI and entity", () => {
    expect(evaluateDemoProof("arkiv", { candidates: [] })).toBe(false);
    expect(
      evaluateDemoProof("arkiv", { candidates: [{ signature: "getRoleMember(bytes32,uint256)" }] }),
    ).toBe(false);
    expect(
      evaluateDemoProof("arkiv", {
        candidates: [{ signature: "getRoleMember(bytes32,uint256)", entityKey: "0xabc" }],
      }),
    ).toBe(true);
  });
  it("requires the actual Swarm root and digest", () => {
    expect(evaluateDemoProof("swarm", { reference: "not-the-root", sha256: "0x123" })).toBe(false);
    expect(
      evaluateDemoProof("swarm", {
        reference: "ac56bcf0360fe3d011060a8011b2ea1e3d71b7408c354075e05fa69f487ae386",
        sha256: "0x67ec935b13fac924b07c7e98013c88f62ad7118f77361e6b93cb6cdeded949e4",
      }),
    ).toBe(true);
  });
  it("distinguishes granted and denied ENSv2 registry permissions", () => {
    const base = { chainId: 11155111, requiredRoles: "1" };
    expect(evaluateDemoProof("granted", { ...base, authorized: true })).toBe(true);
    expect(evaluateDemoProof("denied", { ...base, authorized: false })).toBe(true);
    expect(evaluateDemoProof("granted", { ...base, authorized: false })).toBe(false);
    expect(evaluateDemoProof("denied", { ...base, authorized: true })).toBe(false);
    expect(evaluateDemoProof("gra¶»§q«^