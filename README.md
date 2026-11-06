# ATLAS

ATLAS helps developers identify, decode, and investigate EVM contract interactions with a provenance-aware signature registry mirrored to Arkiv.

## Status

The full local vertical slice is implemented and tested: shared contracts, a
provenance-aware importer, the Arkiv adapter, core lookup/decode logic, a chain
reader, a Fastify REST API, a typed SDK, a CLI, and the seven-route Studio.
Event Inspector and Transaction Lab now call the API, and Explorer/Decoder use
the same contracts.

One real OpenZeppelin function record has been written to Arkiv Rabdi, read
back, and confirmed through the API and Studio. This is **one record only**, not
a full source import. Event signatures are not written, and no contract or
dataset has been deployed; only that single record is published to Arkiv. The
API's Vercel entry-point collision is addressed in source; production readiness
still requires the live routing checks in the deployment guide. See
[docs/arkiv-live-proof.md](docs/arkiv-live-proof.md),
[docs/implementation-status.md](docs/implementation-status.md), and
[docs/production-readiness.md](docs/production-readiness.md) for evidence and
open gates.

## Requirements

- Node.js 24.13.0 (or another supported Node.js version `>=22.18.0 <25`)
- pnpm 11.25.0

## Local setup

```sh
pnpm install
pnpm dev
pnpm lint
pnpm format:check
pnpm typecheck
pnpm test
pnpm build

# Build and start the API (reads need Arkiv credentials; transactions need an RPC URL)
pnpm build
ARKIV_ACCESS_KEY=... ATLAS_ARKIV_CREATOR_ADDRESS=0x... PORT=3000   node services/api/dist/server.js

# CLI (same API contract; no publishing)
node packages/cli/dist/bin.js doctor
node packages/cli/dist/bin.js lookup 0xa9059cbb
node packages/cli/dist/bin.js tx 0x... --chain 1

# Offline importer dry run (no credentials, no Arkiv writes)
node importer/dist/cli.js dry-run --source openzeppelin-contracts   --source-dir importer/fixtures --json
```

API endpoints and errors are documented in [docs/api.md](docs/api.md). SDK and CLI
usage live in [packages/sdk/README.md](packages/sdk/README.md) and
[packages/cli/README.md](packages/cli/README.md). Live read-only RPC checks (no signing):
`ATLAS_LIVE_RPC=1 ATLAS_RPC_URL_1=https://... pnpm --filter @atlas/chain test`.
Gated Arkiv checks: `ATLAS_LIVE_ARKIV=1` plus `ARKIV_ACCESS_KEY` and
`ATLAS_ARKIV_CREATOR_ADDRESS`.

The API uses Vercel's native Fastify preset. Keep
[`services/api/src/server.ts`](services/api/src/server.ts) as the sole recognized
Fastify entry point; the app factory and package barrel are named
`app-factory.ts` and `public-api.ts` to avoid Vercel's `app`/`index` auto-detection
collision. The regression test audits recognized entry files, and the API build
checks the compiled package exports. After an approved deployment, verify
`/health`, `/v1/functions/0x9010d07c`, and `/v1/functions/search?q=transfer&limit=1`
as described in [docs/vercel-deployment.md](docs/vercel-deployment.md).

Run the cross-interface check
with `pnpm consistency --api-url <url>` while an API is listening; the
credential-free fixture harness is `node scripts/fixture-api.mjs --port 3114`
(clearly labelled `version: "fixture"`, not Arkiv data).

Tests are organized by workspace package. Add focused tests alongside each implementation phase.

Studio is available locally at the Vite development URL printed by `pnpm dev`. Backend requests stay disabled unless `VITE_ATLAS_API_URL` is configured; see [apps/studio/README.md](apps/studio/README.md).

The completed single-record write proof is
[docs/arkiv-live-proof.md](docs/arkiv-live-proof.md). Further writes require
separate approval; see [docs/arkiv-write-plan.md](docs/arkiv-write-plan.md).

Arkiv client configuration uses `ARKIV_ACCESS_KEY`; `ARKIV_PRIVATE_KEY` is
importer-only and must never be exposed through a `VITE_` variable or deployed
with the read-only API. Local scripts can load an ignored `.env`, but this
workspace is under OneDrive synchronization: do not store credentials in the
synced directory. Use an approved local secret store and move/rotate any
credentials that may have been synced. See
[docs/arkiv-verification.md](docs/arkiv-verification.md) and
[docs/vercel-deployment.md](docs/vercel-deployment.md).

`ATLAS_RPC_URL_1` and `ATLAS_RPC_URL_11155111` are the only chains reported as available. The `ATLAS_LIVE_*` values are one-shot test gates and are ignored outside the gated suites, so a `.env` that sets them changes nothing by default.

## Project structure

See [docs/architecture.md](docs/architecture.md) for workspace boundaries and dependency direction. See [PRD.md](PRD.md) for product requirements, [plan.md](plan.md) for the phase sequence, and [BACKLOG.md](BACKLOG.md) for task status.

## Signature data source and license

The evaluated candidate source is [ethereum-lists/4bytes](https://github.com/ethereum-lists/4bytes), which declares the [MIT license](https://github.com/ethereum-lists/4bytes/blob/2b8a705fe27833b59aac2a2af5d14e0144e1e56e/LICENSE). It was not used because the candidate dataset does not provide record-level provenance to reliably exclude Sourcify-derived entries. One OpenZeppelin function record is live; the rest of the dry-run dataset has not been imported.

The importer instead derives signatures from first-party Solidity source pinned to a commit: [OpenZeppelin Contracts](https://github.com/OpenZeppelin/openzeppelin-contracts) (MIT) and [ethereum/ERCs](https://github.com/ethereum/ERCs) (CC0-1.0). Records carry the commit, file path and line as provenance. Real dry runs validated 3,892 declarations (3,787 distinct signatures) across the two sources; see [docs/reports/dataset-assessment.md](docs/reports/dataset-assessment.md). Event records are extracted but not written yet; the Arkiv `atlas.event-signatures` read schema exists, while the importer event-write path is still pending. See [importer/README.md](importer/README.md) and [docs/data-quality.md](docs/data-quality.md).

## Local-only development

Development stays local until the user explicitly approves a specific hosted repository, push, publication, data write, or deployment action. Do not initialize Git or connect Lovable to a hosted repository during the local-only stage.
