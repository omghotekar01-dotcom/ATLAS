import { ExpirationTime, type PublicArkivClient, type WalletArkivClient } from "@arkiv-network/sdk";
import { eq } from "@arkiv-network/sdk/query";
import { defineSchema, str } from "@arkiv-network/sdk/schema";
import type { Address } from "viem";

const links = defineSchema("atlas.swarm-artifacts", {
  reference: str().indexed(),
  sha256: str(),
  sourceId: str(),
});

export async function readArtifactLink(
  client: PublicArkivClient,
  creator: Address,
  reference: string,
) {
  const { entities } = await client
    .select({ $key: true, reference: true, sha256: true, sourceId: true })
    .from(links, { onMismatch: "throw" })
    .createdBy(creator)
    .where(eq("reference", reference))
    .limit(2)
    .fetch();
  if (entities.length > 1) throw new Error("Multiple trusted entities link this Swarm reference.");
  const entity = entities[0];
  return (
    entity && {
      entityKey: entity.$key,
      reference: entity.reference.value,
      sha256: entity.sha256.value,
      sourceId: entity.sourceId.value,
    }
  );
}

export async function writeArtifactLink(
  wallet: WalletArkivClient,
  creator: Address,
  artifact: { reference: string; sha256: string; sourceId: string },
) {
  if (wallet.account?.address.toLowerCase() !== creator.toLowerCase()) {
    throw new Error("Artifact link signer must match the trusted creator.");
  }
  if (
    !/^[0-9a-f]{64}$/.test(artifact.reference) ||
    !/^0x[0-9a-f]{64}$/.test(artifact.sha256) ||
    !artifact.sourceId ||
    artifact.sourceId.length > 512
  ) {
    throw new Error("Invalid public artifact metadata.");
  }
  return wallet.createEntity(links, artifact, { expiration: ExpirationTime.fromDays(180) });
}
