import { describe, expect, it } from "vitest";
import type { EnsV2RoleResult } from "@atlas/schemas";
import type { FunctionCandidate } from "@/api/types";
import { makePublisherEvidence } from "./PublisherEvidence";

const candidate = {
  signature: "getRoleMember(bytes32,uint256)",
  source: "OpenZeppelin/openzeppelin-contracts",
  sourceId: "pinned-source-id",
  entityKey: `0x${"a".repeat(64)}`,
  provenance: { recordHash: `0x${"b".repeat(64)}`, datasetVersion: "pinned" },
} as FunctionCandidate;
const proof = {
  kind: "ensv2-eac-role",
  chainId: 11155111,
  registry: "0xd4ebcbbdf463c9c45784603db0ddd499bc44a8b4",
  account: "0xf633e7fc17e2bbe0d0965d18ec1821dcb754a3d3",
  resource: "0",
  requiredRoles: "1",
  roleBitmap: "65537",
  authorized: true,
  blockNumber: "12079583",
  warnings: [],
} as unknown as EnsV2RoleResult;

describe("ATLAS ENSv2 publisher evidence", () => {
  it("preserves the source record and never fabricates an ENS source binding", () => {
    const query = { account: proof.account, resource: "0", role: "1" };
    const result = makePublisherEvidence(candidate, "0x9010d07c", query, proof);
    expect(result.source).toMatchObject({
      signature: "getRoleMember(bytes32,uint256)",
      sourceRepository: "OpenZeppelin/openzeppelin-contracts",
      recordHash: candidate.provenance.recordHash,
      arkivEntityKey: candidate.entityKey,
    });
    expect(result.ensv2.proof.authorized).toBe(true);
    expect(result.sourceBindingVerified).toBe(false);
    expect(result.limitation).toContain("No signed or on-chain binding");
  });

  it("retains denied role evidence and scoped ENS queries without inventing ownership", () => {
    const denied = { ...proof, authorized: false };
    const query = { account: proof.account, name: "publisher.eth", role: "16777216" };
    const result = makePublisherEvidence(candidate, "0x9010d07c", query, denied);
    expect(result.ensv2.requestedName).toBe("publisher.eth");
    expect(result.ensv2.requestedResource).toBeNull();
    expect(result.ensv2.proof.authorized).toBe(false);
    expect(result.sourceBindingVerified).toBe(false);
  });
});
