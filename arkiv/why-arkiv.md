# Why Arkiv instead of a conventional database?

Track: [Mirror something Ethereum depends on](https://ethglobal.com/events/mumbai/prizes).

## If we used PostgreSQL, what would be lost?

A central Postgres instance can provide fast indexed selectors and private
backups. It does **not** by itself expose a wallet-created, expiring,
shared data entity whose `$creator`, chain record and expiry can be inspected
independently of our API operator.

Arkiv provides:

- **Publicly addressable, wallet-attributed data**: immutable creator
  provenance on the Rabdi DB-chain, plus an explorer-verifiable write.
- **A common query surface**: consumers can query matching Arkiv schema fields
  and exact owner/creator metadata without asking the ATLAS team to provision
  tables or API keys on our private infrastructure.
- **Expiry as data lifecycle**: entities live for the declared 180-day
  period; our product can plan an auditable renewal/import cycle.
- **Verifiable ingestion**: the importer records transaction hashes and entity
  keys and checks the returned deterministic content hash.

These properties matter for the **shared Ethereum signature catalogue**,
where it is useful to independently inspect the source and creator of a
candidate rather than trust a server's opaque database row.

## What can users do that the original source does not provide?

The original OpenZeppelin repo provides audited Solidity files and a license,
but not an independently queried, selector-indexed Arkiv entity with a
specific writer wallet, expiry and import identity. ATLAS transforms pinned
source declarations into machine-queryable records with record-level commit,
path and line provenance.

Example:

```sh
curl -s https://atlas-api-ivory.vercel.app/v1/functions/0x9010d07c
```

Look for `registry:"arkiv-rabdi"`, `entityKey`,
`datasetVersion`, `recordHash`, `sourceId`, and the real signature.
Run the query yourself; no account with ATLAS is required for the public HTTP
read. To query Arkiv directly you may need your own Arkiv access key.

## Important tradeoffs

- Our Fastify API **is centralized** for convenience. Arkiv still holds the
  canonical entity, and the API uses read-only Arkiv SDK calls rather than
  replacing a failed Arkiv query with demo fixtures.
- Arkiv data is not automatically true or current. The **pinned source hash**
  plus import log make entries independently auditable, not magically correct.
- Current live coverage is **one function record**. Broad usefulness requires
  larger imports, event records and lifecycle maintenance.
- In-memory API rate limiting is per instance, not a global anti-abuse quota.

## Proof

[The Arkiv transaction](https://rabdi.explorer.arkiv.network/tx/0x0ddf2304bc90eacf5430c0d253cf8560f7b3dbbbf62f58f77c7b8a7347623594)
and [the detailed read-back proof](../docs/arkiv-live-proof.md) show
the source, wallet, fee, entity key and live lookup.
