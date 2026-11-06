# Data quality — source, freshness, provenance and query fit

Track: [Mirror something Ethereum depends on](https://ethglobal.com/events/mumbai/prizes).

## Live data vs analyzed data (2026-11-06)

| Measure                                   | Verified count |
| ----------------------------------------- | -------------: |
| Live Arkiv function records               |          **1** |
| Live Arkiv event records                  |          **0** |
| Live writes with read-back verification   |          **1** |
| OpenZeppelin functions extracted offline  |            544 |
| OpenZeppelin events extracted offline     |            159 |
| Ethereum/ERCs functions extracted offline |          2,611 |
| Ethereum/ERCs events extracted offline    |            578 |
| Combined distinct source signatures       |          3,787 |
| ERCs rejected declarations                |             36 |
| OpenZeppelin rejected declarations        |              0 |

The 3,787 count comes from _source analysis_, not Rabdi entity enumeration.
Source report: [dataset assessment](../docs/reports/dataset-assessment.md).
One-record [on-chain proof](../docs/arkiv-live-proof.md).

## Licensing and exclusions

- Primary source: OpenZeppelin Contracts at
  `efaa6f78ab1dde05416246e801c0baaf4f900d49`,
  [MIT](https://github.com/OpenZeppelin/openzeppelin-contracts/blob/efaa6f78ab1dde05416246e801c0baaf4f900d49/LICENSE).
- Secondary source (dry run only): `ethereum/ERCs` at
  `7dafd1125fffbd3832316edeb739608ad82bb4c4`,
  [CC0-1.0](https://github.com/ethereum/ERCs/blob/7dafd1125fffbd3832316edeb739608ad82bb4c4/LICENSE).
- **No Sourcify** records are ingested. `ethereum-lists/4bytes` and
  `4byte.directory` were excluded due to record-level provenance/licensing
  concerns. Details:
  [data-quality investigation](../docs/data-quality.md).

## What makes a record trustworthy?

1. The Git source commit and source tree digest are pinned before parsing.
2. Solidity declarations are canonicalized and selector/topic hashes
   recomputed using `viem`. Unresolved types are rejected, never guessed.
3. Every record retains `source`, `sourceId` (commit/path/line/signature),
   `datasetVersion`, ISO `importedAt`, and deterministic `recordHash`.
4. An importer checkpoint and report bind the dataset to its source identity.
5. Writes are checked by `recordHash` before insertion and verified by
   a post-write read-back. Public transaction references are retained.
6. API reads are filtered to the trusted `$creator`; inconsistent records
   are rejected. Unknown selectors remain empty rather than faked.

## Freshness: current limitation

The live record is an immutable **pinned snapshot**, not a live feed.
It was imported November 6, 2026 and has a configured 180-day expiry.
No automated source update, entity renewal, expiry monitor or bulk refresh
has been deployed. We will not claim otherwise.

Proposed update cycle (not yet operational): nightly source commit checks,
dry-run diff to prior pinned commit, license/source review, batch preflight,
explicit approved writes, post-write verification, and scheduled renewal
before expiry. Failed writes are reconciled, not blindly retried.

## How developers actually search

- `selector`: indexed equality — live, proven at `0x9010d07c`.
- `recordHash`: indexed equality — idempotency and provenance checks.
- `source` and `datasetVersion`: indexed for filtering and auditing.
- Literal signature search uses a **full scan with safe pagination**, not an
  indexed substring search. This is acceptable for one record, but does not
  scale as efficiently as indexed selector equality.
- `topic0`: indexed event equality is prepared, but no live event records
  have been imported.
- When a selector is absent, the API returns a validated empty candidate
  array. When Arkiv is unavailable, it returns an explicit error, not a fixture.

## Reproduce the public proof

```sh
curl -i https://atlas-api-ivory.vercel.app/health
curl -i https://atlas-api-ivory.vercel.app/v1/functions/0x9010d07c
curl -i 'https://atlas-api-ivory.vercel.app/v1/functions/search?q=getRoleMember'
```

[Cloud verification: all four real API checks passed](https://github.com/omghotekar01-dotcom/ATLAS/actions/runs/42230247461).
