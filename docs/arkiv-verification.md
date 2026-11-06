# Arkiv Rabdi implementation notes

## Verified environment

- SDK: `@arkiv-network/sdk` 1.0.1; viem 2.57.16.
- Chain: Rabdi testnet, chain ID 7794095 (`0x76edaf`).
- Official RPC: `https://rpc.rabdi.db-chain.testnet.arkiv.network`.
- Rabdi access key: `rabdi()` requires the `accessKey` option and throws `MissingAccessKeyError` when it is omitted. Passing `""` uses the public, heavily rate-limited endpoint. ATLAS deliberately requires a non-empty `ARKIV_ACCESS_KEY` for predictable reads and writes; this is an adapter policy, not an SDK restriction.
- Read-only access uses `createPublicClient`; signing uses `createWalletClient` and a viem account.
- Creating an entity requires an `ExpirationTime`. The installed SDK exposes `MAX_LIFETIME = 7_884_000` blocks (about 182 days); the adapter uses 180 days. No renewal behavior is implemented.
- SDK query pages are limited to `MAX_LIMIT = 100`. Query rows are flat and typed attributes arrive as `{ type, value }`. The repository orders by stable `$key` and advances with a key-based cursor rather than relying on offset pagination. Repeated `where(...)` calls are additive; `createdBy(...)` replaces only the creator filter.
- `$creator` is immutable provenance; `$owner` may change. Canonical-source queries are constrained to the configured trusted creator and verify returned creator metadata.

These details were checked against the installed SDK 1.0.1 declarations/source and the official references listed below. The package-owned schema and adapter compile against those SDK types.

## Implemented

- `FunctionSignatures` indexes `selector`, `source`, `sourceId`, `importedAt`, `datasetVersion`, and `recordHash`. The signature text is stored as UTF-8 bytes because the SDK caps `str` values at 128 bytes; selector lookup does not need a signature index. `sourceUpdatedAt` is optional and unindexed.
- The package validates required environment variables and validates key shape without including credentials in errors.
- Reads validate returned entities against the shared `FunctionSignatureSchema`, filter by trusted creator, use key-based paging, and deduplicate by `recordHash`.
- `findByRecordHash` supports idempotent imports: the importer skips entities whose content hash already exists and never relies on selector uniqueness.
- Writes validate input, require the configured signer to match the trusted creator, use a 180-day expiry, and are attempted once without blind retries.
- The write and read paths are wired through `@atlas/arkiv` into `importer/src/write.ts`, including read-back verification after an import. They have not been run against Rabdi.
- `checkArkivHealth` performs a read-only chain-ID check, reports Rabdi identity and latency, and distinguishes an unavailable network from a wrong chain. Failure results use a fixed, credential-safe message; callers must still wire the probe into an operational health or doctor surface.

## Not yet verified

No live Rabdi request, test entity write, or read-back has been performed. At the latest local check, `ARKIV_ACCESS_KEY` was neither present in the process environment nor configured in a root `.env` file. No funded test account has been verified. The repository must not claim live connectivity or a successful write/read until the required configuration and approval gates are satisfied.

## References

- [Arkiv first entity](https://docs.arkiv.network/start-here/first-entity/)
- [Arkiv schema definition](https://docs.arkiv.network/schemas/define/)
- [Arkiv filtering](https://docs.arkiv.network/querying/filter/)
- [Arkiv pagination](https://docs.arkiv.network/querying/paginate/)
- [Arkiv Rabdi network](https://docs.arkiv.network/networks/rabdi/)
- Installed SDK package typings and source under `packages/arkiv/node_modules/@arkiv-network/sdk`.
