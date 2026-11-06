# Arkiv schema — ATLAS

Track: [Mirror something Ethereum depends on](https://ethglobal.com/events/mumbai/prizes).

## Real network and ownership

- Network: Arkiv **Rabdi**, chain ID `7794095`.
- RPC: `https://rpc.rabdi.db-chain.testnet.arkiv.network`.
- SDK: `@arkiv-network/sdk@1.0.1`.
- Entity creator/writer wallet:
  [`0xAd797f58aFD3265C00504382171eC0818262D3ca`](https://rabdi.explorer.arkiv.network/address/0xAd797f58aFD3265C00504382171eC0818262D3ca).
- Verified transaction:
  [`0x0ddf2304bc90eacf5430c0d253cf8560f7b3dbbbf62f58f77c7b8a7347623594`](https://rabdi.explorer.arkiv.network/tx/0x0ddf2304bc90eacf5430c0d253cf8560f7b3dbbbf62f58f77c7b8a7347623594).
- The writer account is the trusted `$creator`. The API constrains queries with
  `.createdBy(trustedCreator)` and validates returned creators.
- Expiration: `ExpirationTime.fromDays(180)`, about 180 days; no automatic renewal
  is implemented. An expired record cannot be assumed to remain available.
- **Current on-chain count: 1 function entity, 0 event entities.**

## `atlas.function-signatures` — deployed schema and live record

Defined in [`packages/arkiv/src/schema.ts`](../packages/arkiv/src/schema.ts).
Entity fields (type / Arkiv indexed):

- `selector`: string / **yes** — 4-byte function selector, e.g. `0x9010d07c`.
- `signature`: bytes / no — UTF-8 canonical signature, e.g.
  `getRoleMember(bytes32,uint256)`; encoded as bytes to avoid `str` limits.
- `source`: string / **yes** — originating project, e.g.
  `OpenZeppelin/openzeppelin-contracts`.
- `sourceId`: string / **yes** — `<commit>:<file>:<line>:<signature>`.
- `sourceUpdatedAt`: optional string / no — verified upstream change time, if known.
- `importedAt`: string / **yes** — ISO timestamp for ingestion.
- `datasetVersion`: string / **yes** — pinned source snapshot identity.
- `recordHash`: string / **yes** — deterministic content identity.
- System fields `$key`, `$creator`, and `$owner` are managed by Arkiv;
  the trusted creator is authenticated and checked on every result.

A real Arkiv query uses `FunctionSignatures` and the indexed `selector`:

```ts
import { eq } from "@arkiv-network/sdk/query";
import { FunctionSignatures } from "./packages/arkiv/src/schema.js";

const result = await publicClient
  .select({
    $key: true,
    $creator: true,
    selector: true,
    signature: true,
    source: true,
    sourceId: true,
    importedAt: true,
    datasetVersion: true,
    recordHash: true,
  })
  .from(FunctionSignatures, { onMismatch: "throw" })
  .createdBy("0xAd797f58aFD3265C00504382171eC0818262D3ca")
  .where(eq("selector", "0x9010d07c"))
  .limit(10)
  .fetch();
```

To try it without SDK setup, run the deployed read-only HTTP query:

```sh
curl -i https://atlas-api-ivory.vercel.app/v1/functions/0x9010d07c
```

Expected live result: signature `getRoleMember(bytes32,uint256)`, canonical entity
`0x99f6593a55a1ae91590399a059adad2cfb8faa4cf69471d7f23a053ba407a034`,
dataset `openzeppelin-contracts@efaa6f78ab1d-2026-11-06`.

## `atlas.event-signatures` — read schema only, not populated

- `topic0`: indexed string — event signature hash.
- `signature`: bytes — UTF-8 canonical event signature.
- `indexed`: optional string — param indexed flags, encoded `1,0,1`.
- `source`, `sourceId`, `importedAt`, `datasetVersion`, `recordHash`:
  indexed strings.
- Uses the same trusted creator and expiration intentions.
- Event query code is implemented, but **event writes and live entries are not yet
  validated**. Do not present schema availability as on-chain event coverage.

## Reproducibility and boundaries

- Source license: OpenZeppelin Contracts
  [MIT](https://github.com/OpenZeppelin/openzeppelin-contracts/blob/efaa6f78ab1dde05416246e801c0baaf4f900d49/LICENSE).
- Pinned upstream commit: `efaa6f78ab1dde05416246e801c0baaf4f900d49`.
- Importer: [`importer/`](../importer/README.md), supports dry-run,
  allowlisted source identity, checkpoint, explicit approval and read-back.
- No Sourcify data or Sourcify-derived records were used.
- Full evidence: [`docs/arkiv-live-proof.md`](../docs/arkiv-live-proof.md).
