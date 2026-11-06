# ATLAS + Swarm: read-only artifact gateway

The ATLAS Bee adapter is a **read-only** artifact retrieval tool. Canonical Arkiv metadata remains indexed on Rabdi; arbitrary Swarm references are not automatically linked to an Arkiv entity or blessed as trusted.

## Setup

Set `ATLAS_BEE_URL` **only on the API server** to the origin of a Bee HTTP API, such as `https://api.gateway.ethswarm.org` (validate the gateway's reliability for your demo). It must not contain credentials, a path, or query strings. Never use the browsing web gateway for programmatic reads because a missing reference may return an HTML shell rather than a proper not-found error.

- REST: `GET /v1/artifacts/:reference`
- SDK: `AtlasClient.getSwarmArtifact(reference)`
- CLI: `atlas artifact <64-hex-reference> --json`
- Studio: Integrations → Swarm artifact reader

The response includes the real downloaded bytes as base64 (maximum 64 KiB) plus a separately computed SHA-256 digest. A Swarm reference is **not** itself a SHA-256 hash. Redirects are rejected; errors are explicit and do not silently substitute sample data.

## Not yet qualifying for the Swarm bonus

No postage-backed upload or Arkiv entity linking is claimed by this read-only adapter. To qualify, create a real public ABI/provenance artifact, upload using a valid Bee postage batch with actual service confirmation, capture the Swarm reference, write a linked Arkiv record using a separately approved signer, then query Arkiv, download the Swarm object and verify its contents. Record the entity key, Swarm reference, batch, actual receipts and source license here. None of those write operations should be simulated.

The adapter is intentionally independent from Arkiv's immutable one-record proof; it cannot silently backfill a Swarm reference into the existing record.

## Operator proof sequence

Build the workspace, then run these commands locally. Configure `ATLAS_BEE_URL`, `ATLAS_BEE_POSTAGE_BATCH_ID`, `ARKIV_ACCESS_KEY` and `ATLAS_ARKIV_CREATOR_ADDRESS` in your local environment. For the link step, use the separately approved trusted signer in `ARKIV_PRIVATE_KEY`. Use only public, licensed content and a pinned source identifier.

1. Run `node --env-file-if-exists=.env scripts/swarm-proof.mjs upload <public-abi.json>` to print the file digest and required approval token. After authorizing that specific postage use, set `ATLAS_SWARM_WRITE_APPROVAL=upload:<0x-sha256>` and repeat. Record the Bee-returned reference and payer or batch provider.
2. With `ATLAS_SWARM_WRITE_APPROVAL=link:<reference>`, run `node --env-file-if-exists=.env scripts/swarm-proof.mjs link <reference> <0x-sha256> <source-id>`. It verifies the bytes before the write and emits the real entity and transaction IDs.
3. Run `node --env-file-if-exists=.env scripts/swarm-proof.mjs verify <reference> <0x-sha256>` to query the trusted creator's indexed entity and verify the downloaded artifact. If indexing has not caught up, repeat only verify. Record the actual proof and demo timestamp.

The upload uses the official [Bee HTTP API](https://docs.ethswarm.org/api/) with an existing postage batch. The artifact link is indexed by `reference` in `atlas.swarm-artifacts` and expires after 180 days.
