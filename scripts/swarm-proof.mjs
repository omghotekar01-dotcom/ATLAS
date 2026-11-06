/* globals process, Buffer, console, URL, fetch, AbortSignal */
import { createHash } from "node:crypto";
import { open } from "node:fs/promises";
import { setTimeout } from "node:timers/promises";
import {
  createArkivPublicClient,
  createArkivWalletClient,
  readArkivEnvironment,
  readArtifactLink,
  writeArtifactLink,
} from "../packages/arkiv/dist/index.js";
import { fetchSwarmArtifact } from "../services/api/dist/public-api.js";

const [command, first, second, third] = process.argv.slice(2);
const hex = /^[0-9a-f]{64}$/;
const digestPattern = /^0x[0-9a-f]{64}$/;

function requireApproval(token) {
  if (process.env.ATLAS_SWARM_WRITE_APPROVAL !== token) {
    throw new Error("Supply the action-specific approval token before any write.");
  }
}

async function main() {
  if (command === "upload" && first && !second) {
    const file = await open(first, "r");
    const data = Buffer.alloc(65_537);
    let bytesRead;
    try {
      ({ bytesRead } = await file.read({ buffer: data, length: data.length }));
    } finally {
      await file.close();
    }
    if (!bytesRead || bytesRead === data.length)
      throw new Error("Use a public file of 1–65536 bytes.");
    const content = data.subarray(0, bytesRead);
    const sha256 = `0x${createHash("sha256").update(content).digest("hex")}`;
    console.log(JSON.stringify({ sha256, requiredApproval: `upload:${sha256}` }));
    requireApproval(`upload:${sha256}`);
    const batch = process.env.ATLAS_BEE_POSTAGE_BATCH_ID?.toLowerCase();
    if (!batch || !hex.test(batch)) throw new Error("Configure a valid existing postage batch.");
    const bee = new URL(process.env.ATLAS_BEE_URL ?? "");
    if (
      !["http:", "https:"].includes(bee.protocol) ||
      bee.username ||
      bee.password ||
      bee.pathname !== "/" ||
      bee.search ||
      bee.hash
    ) {
      throw new Error("Configure a Bee HTTP(S) origin without credentials.");
    }
    const response = await fetch(new URL("/bytes", bee), {
      method: "POST",
      redirect: "error",
      signal: AbortSignal.timeout(15_000),
      headers: { "content-type": "application/octet-stream", "swarm-postage-batch-id": batch },
      body: content,
    });
    if (!response.ok) throw new Error(`Bee rejected the upload (HTTP ${response.status}).`);
    const { reference } = await response.json();
    if (typeof reference !== "string" || !hex.test(reference))
      throw new Error("Invalid Bee reference.");
    console.log(JSON.stringify({ reference, sha256, postageBatch: batch, bee: bee.origin }));
    return;
  }

  if (
    !["link", "verify"].includes(command) ||
    !first ||
    !hex.test(first) ||
    !second ||
    !digestPattern.test(second) ||
    (command === "link" && !third)
  ) {
    throw new Error(
      "Usage: swarm-proof.mjs upload <file> | link <ref> <0x-sha256> <sourceId> | verify <ref> <0x-sha256>",
    );
  }
  const creator = process.env.ATLAS_ARKIV_CREATOR_ADDRESS?.trim();
  if (!creator || !/^0x[0-9a-f]{40}$/i.test(creator))
    throw new Error("Configure a trusted Arkiv creator.");
  const env = readArkivEnvironment();
  const client = createArkivPublicClient(env.accessKey);
  const readLink = () =>
    readArtifactLink(client, creator, first).catch(() => {
      throw new Error("Trusted Arkiv link lookup failed.");
    });
  let link = await readLink();
  if (!link && command === "link") {
    requireApproval(`link:${first}`);
    const bytes = await fetchSwarmArtifact(first);
    if (bytes.sha256 !== second) throw new Error("Swarm bytes do not match the expected SHA-256.");
    const wallet = createArkivWalletClient(env);
    const { entityKey, txHash } = await writeArtifactLink(wallet, creator, {
      reference: first,
      sha256: second,
      sourceId: third,
    }).catch(() => {
      throw new Error(
        "Arkiv write failed or its outcome is unknown. Check the explorer before retrying.",
      );
    });
    console.log(JSON.stringify({ entityKey, txHash }));
    for (let attempt = 0; attempt < 5 && !link; attempt++) {
      await setTimeout(2000);
      link = await readLink();
    }
  }
  if (!link || link.sha256 !== second || (third && link.sourceId !== third)) {
    throw new Error(
      "Expected trusted link is missing or mismatched. For pending indexing, run verify; do not repeat the write.",
    );
  }
  const bytes = await fetchSwarmArtifact(link.reference);
  if (bytes.sha256 !== link.sha256)
    throw new Error("Retrieved artifact failed SHA-256 verification.");
  console.log(JSON.stringify({ ...link, bytes: bytes.bytes, verified: true }));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message.split("\n")[0] : "Swarm proof failed.");
  process.exitCode = 1;
});
