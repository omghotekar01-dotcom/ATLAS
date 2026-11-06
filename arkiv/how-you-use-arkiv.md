# How ATLAS uses Arkiv

This optional supporting file explains the current application use of Arkiv.

- The importer **writes** a canonical function-signature entity to Rabdi.
  The signer is `0xAd797f58aFD3265C00504382171eC0818262D3ca`.
- The Fastify API **reads** `atlas.function-signatures` with
  `@arkiv-network/sdk`; Explorer and Decoder consume those API results.
- `selector` and `recordHash` are indexed query fields. `$creator` is
  enforced for source trust. `datasetVersion`, `source`, `sourceId` and
  `importedAt` support provenance filtering and audit.
- A 180-day expiry is explicitly selected for each published entity. A later
  refresh requires approval and is not yet automatic.
- Local UI state, source snapshots, Git history, test fixtures and application
  configuration are intentionally **off Arkiv**; these are build-time and
  presentation concerns rather than shared public signature records.
- Users can query `0x9010d07c` through the live API and see its exact
  canonical source metadata. Unknown selectors do not get guessed.
- Event-indexed query code is available, but no events have been published.

Start with [the schema](schema.md) and
[the on-chain proof](../docs/arkiv-live-proof.md).
