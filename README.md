# ATLAS

ATLAS helps developers identify, decode, and investigate EVM contract interactions with a provenance-aware signature registry mirrored to Arkiv.

## Start here — judge quickstart

- Live landing: https://atlas-ethglobal.vercel.app/
- **One-click live proof:** https://atlas-ethglobal.vercel.app/demo
- Studio: https://atlas-ethglobal.vercel.app/studio
- Canonical Arkiv function lookup: https://atlas-ethglobal.vercel.app/v1/functions/0x9010d07c
- Sponsor permissions: https://atlas-ethglobal.vercel.app/integrations
- Proof-first video guide: [Judge quickstart](docs/JUDGE_QUICKSTART.md)

## Verified technical scope — November 7, 2026

ATLAS is an Ethereum developer-intelligence tool for selector lookup, decoding, transaction investigation and source provenance. It provides a browser Studio, published CLI, typed SDK and REST API.

- **Arkiv Rabdi:** one real canonical ABI function entity written, read back and wallet-attributed. Not 3,892 individually imported entities.
- **Swarm:** 3,892 extracted function/event declarations (3,155 functions and 737 events) split into six uploaded, SHA-verified chunks plus a verified root manifest. Root: ac56bcf0360fe3d011060a8011b2ea1e3d71b7408c354075e05fa69f487ae386. Linked to Arkiv in [this on-chain transaction](https://rabdi.explorer.arkiv.network/tx/0x2fabf43c602c6693b40dbba5bd75f436050ad82baf6753036620f98df65631a7).
- **ENSv2 Sepolia:** real Enhanced Access Control granted/denied registrar role reads. Registry permissions do **not** prove that the account authored or signed the ABI.
- **0G:** no verified live Private Computer inference request ID yet.
- **EF Anon-RPC:** browser-only exploration; not yet the default transport for all app RPC reads.
- **Production:** public landing at /, original workspace at /studio, and a guided read-only demo at /demo. Its four result states are validated against real API responses—not hardcoded successes.

## Requirements

- Node.js 24.13.0 (or another supported Node.js version `>=22.18.0 <25`)
- pnpm 11.25.0

## Public CLI

Run the [ATLAS CLI on npm](https://www.npmjs.com/package/@omghotekar/atlas-cli)
from any directory with Node.js 22.18 or newer:

```sh
npx --yes --package=@omghotekar/atlas-cli@0.1.0 atlas --timeout 45000 lookup 0x9010d07c --json
```

It uses the public ATLAS API by default. Use `--api-url` to query another deployment.

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

# CLI (local workspace build)
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

## Hackathon release and Arkiv judging

- **Production API**: https://atlas-api-ivory.vercel.app
- **Try a real Arkiv lookup**: https://atlas-api-ivory.vercel.app/v1/functions/0x9010d07c
- **Wallet that created the live entity**: `0xAd797f58aFD3265C00504382171eC0818262D3ca`.
- **Arkiv Rabdi**: chain ID `7794095`; [transaction proof](https://rabdi.explorer.arkiv.network/tx/0x0ddf2304bc90eacf5430c0d253cf8560f7b3dbbbf62f58f77c7b8a7347623594).
- **Sponsor rubric**: [schema](arkiv/schema.md), [friction](arkiv/friction.md), [reach](arkiv/reach.md), [why Arkiv](arkiv/why-arkiv.md), and [data quality](arkiv/data-quality.md).
- **Submission checklist**: [docs/SUBMISSION.md](docs/SUBMISSION.md).
- **Code license**: [MIT](LICENSE); imported source remains governed by its upstream MIT/CC0 license.
- **AI use**: ChatGPT and VS Code Copilot were used for implementation, testing, review, CI, documentation and deployment assistance under human supervision. See [AI disclosure](docs/SUBMISSION.md#honest-ai-use-disclosure).

The repository was originally local-first. It is now hosted by explicit user request.
Only separately approved Arkiv signing/import operations may create more entities.

## Optional 4byte.directory community comparison

ATLAS includes a **read-only, non-canonical** community selector lookup at
`GET /v1/community/4byte/:selector`, in `atlas 4byte`, and in the Studio Explorer.
Community candidates never enter the Arkiv canonical mirror; they are unverified.
See [4byte documentation](docs/FOURBYTE_AND_CLI.md).

## Sponsor release and verification

See the [sponsor readiness matrix](docs/SPONSOR_READINESS.md), [build and test commands](docs/TESTING.md), and [deployment checklist](docs/DEPLOYMENT.md). Studio includes a public landing, a one-click guided demo and the original developer workspace.

The [ATLAS CLI guide](packages/cli/README.md) covers npm archive installation, release packaging, and sponsor commands.
