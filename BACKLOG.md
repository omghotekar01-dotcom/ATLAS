# ATLAS --- Engineering Backlog

**Document status:** Execution backlog\
**Source of truth:** `PRD.md`\
**Execution sequence:** `plan.md`\
**Rule:** A task is not complete without implementation evidence and
passing acceptance checks.

------------------------------------------------------------------------

## 0. How to use this backlog

-   Work top-to-bottom within dependency order.
-   P0 is mandatory for the MVP; P1 is an extension; P2 is optional.
-   Do not start blocked work.
-   Each task must result in code, tests, documentation, or a verified
    operational artifact.
-   Agents must update status, evidence, and commit/PR reference.
-   Never mark an integration complete because a mock passes.
-   If the external SDK differs from assumptions, record verified facts
    and update this backlog before changing architecture.

### Status vocabulary

-   `TODO`
-   `IN_PROGRESS`
-   `BLOCKED`
-   `DONE`
-   `DEFERRED`

### Priority vocabulary

-   `P0`: must ship.
-   `P1`: important extension.
-   `P2`: optional/post-MVP.

### Completion evidence

For every completed task, record: - Changed files. - Test command(s). -
Test result. - Manual verification steps where needed. - Relevant commit
or PR. - Known limitations.

------------------------------------------------------------------------

## Execution constraint: local-only until approved

Do not create a hosted repository, initialize Git, commit, add a remote, push, publish packages, or deploy during the local-only development stage. The user must approve each external action separately. Repository and deployment tasks below are late-stage tasks and remain blocked until approval. See PRD sections 0A, 0B, and 16.

## Current verified status --- 2026-11-06

- One OpenZeppelin function record is confirmed on Arkiv Rabdi; it is not a
  full dataset import. Transaction, read-back, API, and Studio evidence:
  `docs/arkiv-live-proof.md`.
- The read-only Vercel preparation for `apps/studio` and `services/api` is
  documented in `docs/vercel-deployment.md`; no project has been created and
  nothing has been deployed.
- The production-readiness audit is in `docs/production-readiness.md`. Current
  blockers include no Git repository, no selected production hostnames, and no
  production-scoped Arkiv read configuration.
- `ARKIV_PRIVATE_KEY` remains importer-only and must not be added to Vercel.
  The local `.env` is in a OneDrive-synchronized directory; move secrets to a
  local secret store outside the synced folder.

## Implementation status record --- 2026-11-06

This record supersedes the inline `TODO` assumptions for the epics below. It is
an honest summary, not a claim that every acceptance detail is met.

| Epic | Status | Evidence / residual |
| ---- | ------ | ------------------- |
| E05 Function resolver | DONE | `@atlas/core` 22 tests; ambiguity, deterministic order, empty result, honest full-scan search with cursor |
| E06 Calldata decoding | DONE | Round-trip re-encode, bigint decimal strings, per-candidate failures |
| E07 Event support | PARTIAL | Topic resolver, indexed-aware log decoder, `/v1/events`, `/v1/decode/logs`, Arkiv event read adapter and Event Inspector wiring are done; event writes/import remain (PRD phase 10) |
| E08 Chain/RPC adapter | DONE | `@atlas/chain` 10 tests; chains 1 and 11155111 only, env-gated, no default RPC, RPC failure taxonomy |
| E09 Transaction investigation | DONE | Top-level calldata + logs only; internal calls explicitly listed as a limitation; API tests |
| E10 REST API | DONE | Seven routes, request IDs, rate limit, timeout, shared errors; live smoke test without credentials |
| E11 TypeScript SDK | DONE (unpublished) | 9 tests, zod validation, typed errors; package is `private`, no npm publish |
| E12 Professional CLI | DONE (unpublished) | 10 tests, human/JSON output, `--api-url`/`--timeout`, exit codes 0/1/2/3/4 |
| E13 Studio | DONE | Seven routes preserved; status distinguishes implementation from live health; live coverage is clearly limited to one record |
| E16 Docs | PARTIAL | Live proof, Vercel deployment guide, production-readiness audit, API docs and dataset status are documented; PRD source-policy decision remains |
| E19 Hosted/deployed | PREPARED / BLOCKED | Vercel project settings are prepared locally; Git, hostnames, production variables, and separate approval remain |

Cross-interface consistency: `scripts/consistency.mjs` passed REST = SDK = CLI
against an in-memory repository. This is separate from the one real Arkiv API
record in `docs/arkiv-live-proof.md`; a full live consistency run remains open.

## EPIC E01 --- Local project foundation

**Goal:** Establish a reproducible monorepo and engineering standards.

### E01-T01 --- Initialize local project workspace

-   Priority: P0
-   Status: DONE
-   Evidence: Root workspace manifests, package skeletons, local setup documentation, and local-only policy added. `pnpm install --frozen-lockfile` and `pnpm build` pass.
-   Tasks: create the local project directory; create root package manifest; configure pnpm workspace; add Node version policy; add local ignore rules; create README skeleton. Do not run `git init`, create a remote, or commit.
-   Acceptance: the local workspace installs and builds from documented commands. Hosted repository creation is deferred to the approved release phase.

### E01-T02 --- TypeScript baseline

-   Priority: P0
-   Status: DONE
-   Evidence: Strict shared TypeScript options and a root compiler config added; `pnpm typecheck` passes. Package-specific configs will accompany package source in later phases.
-   Tasks: strict TypeScript config; shared base config;
    package-specific configs as package source is introduced; path/export conventions; declaration build
    strategy.
-   Acceptance: all implemented package source compiles with strict checks.

### E01-T03 --- Quality tooling

-   Priority: P0
-   Status: DONE
-   Evidence: ESLint, Prettier, Vitest, and root check scripts configured; `pnpm lint`, `pnpm format:check`, and `pnpm test` pass. The test runner correctly permits an empty suite before test files exist.
-   Tasks: ESLint; Prettier; Vitest; coverage baseline; scripts for
    lint/typecheck/test/build.
-   Acceptance: root commands run deterministically.

### E01-T04 --- Workspace packages

-   Priority: P0
-   Status: DONE
-   Evidence: All 10 workspaces resolve during `pnpm install --frozen-lockfile`; package boundaries are documented and no placeholder business logic was added.
-   Tasks: create schemas, core, arkiv, chain, sdk, cli, API, importer,
    Studio package skeletons; define dependency direction; add package
    names and exports.
-   Acceptance: no circular dependencies; core remains
    framework-independent.

### E01-T05 --- Environment and secrets policy

-   Priority: P0
-   Status: DONE
-   Evidence: Secret-safe `.env.example`, ignore rules, and local-only setup guidance added. No runtime variables are required before integrations are introduced.
-   Tasks: `.env.example`; environment validation when integration variables are introduced; secret exclusion;
    local setup docs; config error messages.
-   Acceptance: `.env.example` and secret exclusion are in place; future required configuration must fail clearly without exposing secrets.

------------------------------------------------------------------------

## EPIC E02 --- Domain model and validation

**Goal:** Define canonical contracts shared across all modules.

### E02-T01 --- Shared primitive types

-   Priority: P0
-   Status: DONE
-   Evidence: Branded selector, topic0, address, chain ID, hash, hex data, timestamp, entity key, and signature types are defined in `packages/schemas/src/primitives.ts`.
-   Define selector, topic, address, chain ID, timestamp, hash, entity
    key, and provenance types.
-   Acceptance: types are reused rather than redefined in each package.

### E02-T02 --- Runtime schemas

-   Priority: P0
-   Status: DONE
-   Evidence: Zod schemas for function/event records, observations, manifests, lookup/decode/transaction results, logs, JSON values, and API errors are implemented and covered by tests.
-   Add Zod schemas for function records, event records, observations,
    manifests, lookup results, decode results, and API errors.
-   Acceptance: invalid boundary data is rejected with useful errors.

### E02-T03 --- Normalization

-   Priority: P0
-   Status: DONE
-   Evidence: Selector, topic0, address, hex data, and signature normalization plus strict width/encoding validation are implemented and tested.
-   Normalize hex casing and prefix; validate selector length; validate
    topic length; normalize addresses; normalize signature whitespace
    conservatively.
-   Acceptance: normalization is deterministic and tested.

### E02-T04 --- Deterministic hashes

-   Priority: P0
-   Status: DONE
-   Evidence: Sorted-key canonical JSON and Web Crypto SHA-256 function/event record hashing are implemented and tested for stability, invalid JSON values, and source identity changes.
-   Define canonical serialization; hash stable source identity/content;
    document fields included in hash.
-   Acceptance: identical logical records produce identical hashes.

### E02-T05 --- Error taxonomy

-   Priority: P0
-   Status: DONE
-   Evidence: Domain error classes/codes and shared HTTP-status/CLI-exit mapping plus API error serialization are implemented and tested.
-   Define domain errors for invalid input, not found, ambiguous, decode
    failure, upstream unavailable, rate limit, and authorization.
-   Acceptance: API and CLI map errors consistently.

### Phase 02 --- Domain types and validation

- **Task IDs:** E02-T01 through E02-T05
- **Status:** DONE
- **Owner/Agent:** Copilot
- **Changed files:** `packages/schemas` primitives, schemas, hash helpers, and tests; `docs/architecture.md`; `README.md`; `plan.md`; this backlog; root TypeScript configuration.
- **Commands executed:** `pnpm add zod --filter @atlas/schemas`; `pnpm exec prettier --write packages/schemas/src packages/schemas/tsconfig.json tsconfig.json packages/schemas/package.json`; `pnpm lint`; `pnpm format:check`; `pnpm typecheck`; `pnpm test`; `pnpm build`.
- **Results:** All final checks pass; Vitest: 19 tests passed.
- **Manual verification:** Validated malformed selector/topic/address/data, identifier-kind mismatch, candidate ambiguity, manifest counts, and deterministic hash behavior with unit tests.
- **Commit/PR:** None; development remains local-only.
- **Known limitations:** Source selector/topic-to-signature consistency verification is deferred until the upstream importer source and its semantics are verified.
- **Next task:** Phase 03 --- Arkiv SDK and Rabdi verification.

------------------------------------------------------------------------

## EPIC E03 --- Arkiv integration

**Goal:** Prove real Arkiv writes and reads using official SDK behavior.

### E03-T01 --- SDK and network verification

-   Priority: P0
-   Status: DONE
-   Evidence: `docs/arkiv-verification.md` records SDK 1.0.1, viem 2.57.16, Rabdi chain ID, client/signer behavior, schema/query semantics, pagination, creator metadata, and the verified expiry limit.
-   Verify current package name/version, Rabdi configuration, signer
    model, RPC needs, and required dependencies.
-   Acceptance: verification notes include exact official references and
    installed typings.

### E03-T02 --- Minimal connection

-   Priority: P0
-   Status: BLOCKED
-   Evidence: Client construction and environment validation are implemented; no access key is configured, so live connectivity/health cannot yet be verified.
-   Blocker: Requires approved Rabdi access and a configured access key. No connection or write was attempted.
-   Configure client; validate environment; connect to Rabdi; add health
    check.
-   Acceptance: `doctor` or integration script reports real connection
    status.

### E03-T03 --- Schema implementation

-   Priority: P0
-   Status: IN_PROGRESS
-   Evidence: Function-signature schema compiles; tests assert indexed fields. Event and observation schemas remain gated.
-   Implement function schema; validate field types/indexing; verify
    schema naming/tag rules; document expiry support.
-   Acceptance: schema compiles and can be used for a real entity.

### E03-T04 --- Write adapter

-   Priority: P0
-   Status: IN_PROGRESS
-   Evidence: Validated write adapter captures entity key and transaction hash, enforces trusted signer identity, and uses the verified expiry API. Live write acceptance remains pending.
-   Implement typed write operation; capture entity key and transaction
    reference if supported; map SDK errors.
-   Acceptance: one real test entity is written.

### E03-T05 --- Read adapter

-   Priority: P0
-   Status: IN_PROGRESS
-   Evidence: Selector query validates records, verifies creator metadata, and uses deterministic keyset pagination. A `findByRecordHash` lookup was added for idempotent imports. Repository tests now cover creator rejection, hash lookup, two-page cursor advancement, and a stalled cursor. Live read-back acceptance remains pending.
-   Implement selector query; owner/creator verification; validation of
    returned entity.
-   Acceptance: written test entity is read back and verified.

### E03-T06 --- Pagination

-   Priority: P0
-   Status: IN_PROGRESS
-   Evidence: Read adapter uses ordered entity keys and a key-based continuation cursor, with a safe non-advancement check. Unit tests read 100 + 1 entities across two pages and fail a stalled cursor. A live multi-page run remains pending.
-   Implement cursor/page handling; avoid duplicate pages; stop safely;
    test multi-page behavior.
-   Acceptance: every matching page is read.

### E03-T07 --- Expiration and renewal

-   Priority: P1
-   Status: BLOCKED
-   Evidence: Current maximum lifetime and `ExpirationTime` support are documented. Renewal is not implemented because no verified renewal behavior is available in the installed SDK flow.
-   Verify expiry API and renewal semantics; implement only supported
    behavior; document limits.
-   Acceptance: lifecycle behavior is tested or a documented alternative
    is chosen.

### E03-T08 --- Arkiv diagnostics

-   Priority: P0
-   Status: IN_PROGRESS
-   Evidence: Added a read-only Rabdi chain-ID health probe with latency measurement, explicit wrong-network/unavailable statuses, and credential-safe actionable errors in `packages/arkiv/src/health.ts`; tests cover success, wrong-network, and failure cases. SDK 1.0.1 behavior was re-verified: a missing access key throws, while `""` selects the public rate-limited endpoint; our adapter intentionally requires a non-empty key. Wiring to a runnable doctor/API health surface remains.
-   Acceptance: dependency failures are distinguishable from empty
    results.

### Phase 03 --- Arkiv SDK and Rabdi verification

- **Status:** IN_PROGRESS
- **Evidence:** SDK verification, client setup, function-signature schema, repository adapter, and unit tests are implemented. Re-verified SDK 1.0.1 access-key, expiry, page-limit, typed-row and filter semantics. Added `findByRecordHash` for import idempotency plus creator, hash, two-page pagination and stalled-cursor tests (15 package tests). Existing read-only Rabdi health probe remains unwired to a runnable doctor/API surface. Full workspace `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test` (92 executed / 73 distinct) and `pnpm build` pass.
- **Blocker:** Real Rabdi connectivity and write/read-back still require approved access and configured credentials; no network write was attempted.
- **Next task:** Keep live Rabdi verification approval-gated; implement the core resolver and API lookup before the importer's live run.

------------------------------------------------------------------------

## EPIC E04 --- Source importer

**Goal:** Create a reproducible and idempotent source-to-Arkiv pipeline.

### E04-T01 --- ethereum-lists/4bytes source client

-   Priority: P0
-   Status: BLOCKED
-   Evidence: Inspected pinned upstream commit `2b8a705fe27833b59aac2a2af5d14e0144e1e56e` and evaluated 4byte.directory, its predecessor registry, and Etherface. See `docs/data-quality.md` for source/license/provenance findings.
-   Blocker: No evaluated source provides both a verified redistribution license and reliable per-record provenance to exclude Sourcify-derived data; PRD QG-03 prohibits using mixed-provenance datasets.
-   Verify API endpoints and response schemas; implement pagination;
    timeouts; bounded retries.
-   Acceptance: fetches actual source records.

### E04-T02 --- Function normalization

-   Priority: P0
-   Status: DONE (offline, derived source)
-   Evidence: `importer/src/solidity.ts` and `normalize.ts` map pinned first-party Solidity declarations to shared `FunctionSignature`/`EventSignature` records with canonical ABI types, source IDs, deterministic hashes, and shared-schema validation. 28 importer tests pass.
-   Map upstream records to domain records; preserve source ID;
    normalize selector/signature; record timestamps.
-   Acceptance: source-to-domain mapping tests pass.

### E04-T03 --- Validation and collision detection

-   Priority: P0
-   Status: DONE (offline, derived source)
-   Evidence: Selector/topic0 come from `viem` by construction; user-defined/function/mapping types and constant array lengths are rejected with structured reasons instead of guessed. Distinct signatures sharing one selector are preserved; identical signatures across files are collapsed deterministically.
-   Validate selector/hash consistency; reject malformed records;
    preserve collisions; report anomalies.
-   Acceptance: malformed and colliding records are handled correctly.

### E04-T04 --- Import dry run

-   Priority: P0
-   Status: DONE (offline, derived source)
-   Evidence: `node importer/dist/cli.js dry-run ...` reads a local pinned tree, never constructs an Arkiv client, never writes, and emits counts plus `ImportManifest`. Verified over fixtures: 3 files, 12 declarations, 10 validated, 2 duplicates, 3 rejections, 0 writes.
-   Calculate expected writes; show counts and failures; do not sign or
    write.
-   Acceptance: dry-run performs no Arkiv writes.

### E04-T05 --- Idempotent writer

-   Priority: P0
-   Status: IN_PROGRESS
-   Evidence: `importer/src/write.ts` looks up `recordHash` before writing, skips existing content, attempts each write once, and records failures without retry. Unit tests cover skip, write, failure and no-retry paths. No live write has run.
-   Detect existing content hashes; write only missing/changed records;
    avoid selector-based uniqueness.
-   Acceptance: rerun does not create unnecessary duplicates.

### E04-T06 --- Checkpoint/resume

-   Priority: P1
-   Status: TODO
-   Evidence: Not implemented. The importer scans a local tree deterministically; resumable checkpoints are needed for live paginated source ingestion.
-   Persist safe checkpoint state; resume after interruption; validate
    checkpoint version.
-   Acceptance: interrupted import resumes without skipped pages.

### E04-T07 --- Import manifest

-   Priority: P0
-   Status: DONE (offline, derived source)
-   Evidence: `importer/src/report.ts` builds a schema-valid `ImportManifest` with source, pinned tree endpoint, importer version, dataset version, timestamps, counts, failure summary, licence URL and importer identity. Reports are emitted by the CLI and can be written with `--report`.
-   Record source, source snapshot, importer version, wallet,
    timestamps, counts, and failures.
-   Acceptance: each completed run has an auditable report.

### E04-T08 --- Read-back verification

-   Priority: P0
-   Status: IN_PROGRESS
-   Evidence: `verifyFunctionRecords` reads each written hash back and compares selector/signature, reporting verified, missing and mismatched sets; unit tests cover all three. The CLI runs it after import and fails the exit code on missing records. No live run has exercised it.
-   Query imported records from Arkiv; compare hashes and counts;
    produce mismatch report.
-   Acceptance: successful import is not declared until verification
    succeeds.

### E04-T09 --- Pinned first-party source definition

-   Priority: P0
-   Status: DONE
-   Evidence: `importer/src/sources.ts` defines OpenZeppelin Contracts (commit `efaa6f78ab1dde05416246e801c0baaf4f900d49`, MIT) and ethereum/ERCs (commit `7dafd1125fffbd3832316edeb739608ad82bb4c4`, CC0-1.0) with repository, commit, licence name/URL and local path rules. Network fetching is intentionally not performed; the operator supplies a checkout of the pinned commit.
-   Acceptance: every derived record can name a repository, commit, file and canonical signature.

### E04-T10 --- Deterministic Solidity extraction

-   Priority: P0
-   Status: DONE
-   Evidence: `importer/src/solidity.ts` walks the typed AST, keeps only external/public named functions and all events, canonicalizes ABI types, computes selectors/topic0 with `viem`, and rejects declarations needing compiler-level symbol resolution. Covered by 9 tests including known selector/topic vectors and structured rejections.
-   Acceptance: unsupported declarations fail loudly; supported signatures are exact.

### E04-T11 --- Derived-source dry run

-   Priority: P0
-   Status: DONE
-   Evidence: `pipeline.ts` + `report.ts` + `cli.ts` produce a deterministic dry-run report and schema-valid manifest without credentials or network access. Verified counts over fixtures: 3 files, 12 declarations, 10 validated (8 functions, 2 events), 2 duplicates, 3 rejections, 0 writes.
-   Acceptance: dry run never constructs a client or writes.

### E04-T12 --- Approval-gated live import

-   Priority: P0
-   Status: BLOCKED
-   Evidence: `write.ts` implements hash-first idempotent writes, single-attempt semantics, creator enforcement and read-back verification; the CLI refuses `import` without `--confirm-write`. No live run has occurred.
-   Blocker: Requires `ARKIV_ACCESS_KEY`, a funded `ARKIV_PRIVATE_KEY`, and explicit user approval for public Rabdi writes (PRD Gate D).
-   Acceptance: a real pinned checkout is imported and read back with a recorded manifest.

### E04-T13 --- Source-policy decision for the PRD

-   Priority: P0
-   Status: TODO
-   Evidence: The derived-source approach is Sourcify-free and record-level attributable, but the PRD names `ethereum-lists/4bytes`. The deviation needs an explicit product decision and PRD/backlog wording update.
-   Acceptance: the chosen initial source and its provenance guarantees are stated in the PRD.

### Phase 04 --- Source importer

- **Status:** IN_PROGRESS
- **Evidence:** Replaced the untyped `importer/extractor.ts` with `importer/src` (sources, solidity, normalize, report, pipeline, write, cli) and 28 tests. `pnpm lint`, `pnpm format:check`, typecheck, tests and build pass; built CLI dry run verified against fixtures. Sourcify/4bytes remains blocked, so the pipeline derives from pinned MIT/CC0 Solidity instead.
- **Blocker:** Live write/read-back needs credentials, funding and approval; checkpoint/resume and event writes are not implemented.
- **Next task:** E04-T13 (source-policy decision), then E05/E10 so an imported record can be looked up through the API.

------------------------------------------------------------------------

## EPIC E05 --- Function resolver

**Goal:** Resolve selectors from canonical Arkiv records.

### E05-T01 --- Repository interface

-   Priority: P0
-   Define port in core; implement Arkiv adapter separately.
-   Acceptance: core tests can use a fake repository without importing
    Arkiv SDK.

### E05-T02 --- Selector lookup

-   Priority: P0
-   Validate selector; query Arkiv; verify owner; paginate; validate
    results.
-   Acceptance: real selector returns all matching records.

### E05-T03 --- Collision semantics

-   Priority: P0
-   Return all candidates; set ambiguous flag; deterministic ordering;
    expose provenance per candidate.
-   Acceptance: collision fixture returns every candidate.

### E05-T04 --- Search by signature text

-   Priority: P0
-   Implement query strategy supported by Arkiv; if substring search is
    unsupported, use a bounded, explicit alternative and document
    limits.
-   Acceptance: no false claim of full-text search capability.

### E05-T05 --- Unknown selector behavior

-   Priority: P0
-   Return a valid empty result; support suggestion to submit
    observation later.
-   Acceptance: no matching record is not treated as infrastructure
    failure.

------------------------------------------------------------------------

## EPIC E06 --- Calldata decoding

**Goal:** Decode raw calldata using candidate signatures.

### E06-T01 --- Calldata parser

-   Priority: P0
-   Validate hex; require selector bytes; extract selector and argument
    payload.
-   Acceptance: malformed and short calldata rejected.

### E06-T02 --- viem integration

-   Priority: P0
-   Verify installed viem APIs; build function ABI item from candidate
    signature; decode args.
-   Acceptance: known test vectors decode correctly.

### E06-T03 --- Multi-candidate decoding

-   Priority: P0
-   Attempt every candidate; preserve individual failures; do not select
    first candidate silently.
-   Acceptance: collision case exposes all outcomes.

### E06-T04 --- Output serialization

-   Priority: P0
-   Serialize bigint as decimal string; preserve addresses/bytes; avoid
    lossy JSON conversion.
-   Acceptance: JSON output is valid and round-trippable for supported
    values.

### E06-T05 --- Decode result contract

-   Priority: P0
-   Include selector, candidate, signature, argument names/types/values,
    status, ambiguity, provenance, warnings.
-   Acceptance: API/SDK/CLI/Studio share one result model.

------------------------------------------------------------------------

## EPIC E07 --- Event signature and log support

**Goal:** Add event intelligence after function vertical slice is
stable.

### E07-T01 --- Verify upstream event endpoint

-   Priority: P1
-   Confirm endpoint, pagination, fields, source IDs, and hash
    semantics.
-   Acceptance: source verification notes are committed.

### E07-T02 --- Event Arkiv schema

-   Priority: P1
-   Define event record schema and indexed topic0.
-   Acceptance: real event entity write/read test passes.

### E07-T03 --- Event importer

-   Priority: P1
-   Implement normalization, validation, idempotency, manifest, and
    read-back.
-   Acceptance: event mirror is reproducible.

### E07-T04 --- Topic resolver

-   Priority: P1
-   Query all candidates and preserve provenance.
-   Acceptance: known topic resolves from Arkiv.

### E07-T05 --- Log decoder

-   Priority: P1
-   Decode indexed and non-indexed values using viem; handle candidate
    ambiguity.
-   Acceptance: known log fixtures decode.

### E07-T06 --- Event UI/API/CLI

-   Priority: P1
-   Add endpoint, CLI command, and Studio inspector.
-   Acceptance: event flow is usable end-to-end.

------------------------------------------------------------------------

## EPIC E08 --- Chain/RPC adapter

**Goal:** Retrieve real EVM facts without confusing them with registry
interpretations.

### E08-T01 --- Chain configuration

-   Priority: P1
-   Define supported chain IDs and RPC configuration; validate
    endpoints.
-   Acceptance: unsupported chain errors are explicit.

### E08-T02 --- viem public clients

-   Priority: P1
-   Configure read-only clients; timeouts; retries; chain identity
    checks.
-   Acceptance: `doctor` checks configured RPC.

### E08-T03 --- Transaction retrieval

-   Priority: P1
-   Fetch transaction; handle not found/pending; normalize values.
-   Acceptance: transaction fields match RPC response.

### E08-T04 --- Receipt retrieval

-   Priority: P1
-   Fetch receipt; handle success/revert; normalize logs.
-   Acceptance: status is sourced from receipt.

### E08-T05 --- RPC failure semantics

-   Priority: P1
-   Map timeout, rate limit, unavailable, unsupported chain, and not
    found.
-   Acceptance: failures are distinguishable.

------------------------------------------------------------------------

## EPIC E09 --- Transaction investigation

**Goal:** Combine chain facts and Arkiv-backed interpretations into an
evidence report.

### E09-T01 --- Investigation use case

-   Priority: P1
-   Define service orchestration and result contract.
-   Acceptance: no provider-specific code leaks into core.

### E09-T02 --- Input selector resolution

-   Priority: P1
-   Extract selector from transaction input; query Arkiv.
-   Acceptance: evidence labels distinguish RPC and Arkiv.

### E09-T03 --- Input decoding

-   Priority: P1
-   Decode each candidate; preserve ambiguity/failure.
-   Acceptance: no unsupported safety verdict.

### E09-T04 --- Receipt log analysis

-   Priority: P1
-   Resolve and decode event logs when event mirror is available.
-   Acceptance: unknown topics are visible.

### E09-T05 --- Investigation report

-   Priority: P1
-   Generate stable JSON report with facts, interpretations, provenance,
    and limitations.
-   Acceptance: report is reproducible.

### E09-T06 --- Transaction tests

-   Priority: P1
-   Use fixed known transaction fixtures or controlled testnet
    transactions.
-   Acceptance: success, revert, unknown selector, and missing RPC paths
    covered.

------------------------------------------------------------------------

## EPIC E10 --- REST API

**Goal:** Expose stable, validated HTTP contracts.

### E10-T01 --- Fastify foundation

-   Priority: P0
-   Create server, config, health route, graceful shutdown.
-   Acceptance: server starts and health reports dependencies
    accurately.

### E10-T02 --- Request validation

-   Priority: P0
-   Add Zod schemas, bounds, content-type handling.
-   Acceptance: invalid payloads receive stable errors.

### E10-T03 --- Function lookup route

-   Priority: P0
-   Implement lookup endpoint and response contract.
-   Acceptance: response comes from Arkiv-backed core.

### E10-T04 --- Search route

-   Priority: P0
-   Implement search and bounded pagination.
-   Acceptance: cursor behavior is tested.

### E10-T05 --- Calldata decode route

-   Priority: P0
-   Implement endpoint; stable errors; JSON-safe bigint values.
-   Acceptance: valid calldata decodes through shared core.

### E10-T06 --- Event routes

-   Priority: P1
-   Add only after event support is real.
-   Acceptance: no mock event endpoint in production.

### E10-T07 --- Transaction route

-   Priority: P1
-   Add only after chain adapter and investigation use case work.
-   Acceptance: RPC/Arkiv source distinction is explicit.

### E10-T08 --- API reliability

-   Priority: P0
-   Request IDs, logging, timeouts, rate limits, CORS, error
    sanitization.
-   Acceptance: abuse and dependency failure tests pass.

------------------------------------------------------------------------

## EPIC E11 --- TypeScript SDK

**Goal:** Make ATLAS easy to embed in TypeScript projects.

### E11-T01 --- Client design

-   Priority: P0
-   Define constructor, options, typed errors, timeout behavior.
-   Acceptance: API surface matches API contracts.

### E11-T02 --- HTTP transport

-   Priority: P0
-   Implement fetch transport, base URL, headers, abort timeout.
-   Acceptance: network errors map to typed SDK errors.

### E11-T03 --- Lookup/search methods

-   Priority: P0
-   Implement methods using API routes.
-   Acceptance: types and runtime behavior match API.

### E11-T04 --- Calldata decode method

-   Priority: P0
-   Implement typed method and result parsing.
-   Acceptance: example app works.

### E11-T05 --- Event/transaction methods

-   Priority: P1
-   Implement when endpoints ship.
-   Acceptance: no unsupported methods that return fake data.

### E11-T06 --- Packaging

-   Priority: P0
-   Configure exports, ESM/CJS strategy if needed, build, package
    metadata, README.
-   Acceptance: package imports from a clean example project.

### E11-T07 --- SDK tests

-   Priority: P0
-   Mock HTTP boundary; test success/error/timeout.
-   Acceptance: tests verify request paths and response parsing.

------------------------------------------------------------------------

## EPIC E12 --- Professional CLI

**Goal:** Deliver a polished automation-friendly terminal experience.

### E12-T01 --- CLI foundation

-   Priority: P0
-   Configure Commander, version/help, config loader.
-   Acceptance: `atlas --help` and `atlas --version` work.

### E12-T02 --- Lookup command

-   Priority: P0
-   Validate selector; call SDK/API; render candidate list.
-   Acceptance: human and JSON output work.

### E12-T03 --- Search command

-   Priority: P0
-   Query search endpoint; pagination; readable results.
-   Acceptance: output is bounded and deterministic.

### E12-T04 --- Decode command

-   Priority: P0
-   Validate calldata; render decoded arguments and provenance.
-   Acceptance: known calldata and invalid calldata paths work.

### E12-T05 --- JSON mode

-   Priority: P0
-   Ensure stdout is pure JSON; diagnostics to stderr.
-   Acceptance: output can be piped to `jq`.

### E12-T06 --- Exit codes

-   Priority: P0
-   Implement documented codes and strict-mode behavior.
-   Acceptance: shell tests assert exit status.

### E12-T07 --- Doctor/config

-   Priority: P0
-   Check API, Arkiv/RPC status where exposed; config set/get if
    implemented.
-   Acceptance: no secrets printed.

### E12-T08 --- CLI packaging

-   Priority: P0
-   Build executable/package, bin entry, installation docs.
-   Acceptance: run from a clean environment.

### E12-T09 --- Reports and advanced commands

-   Priority: P1
-   Add event, transaction, report export after dependencies ship.
-   Acceptance: files are valid JSON and paths are handled safely.

------------------------------------------------------------------------

## EPIC E13 --- Lovable-first Studio UI and integration

**Goal:** Establish a cohesive premium interface before feature screens.

### E13-T00 --- Generate initial UI in Lovable
-   Priority: P0
-   Status: DONE
-   Evidence: Reviewed the user's public Lovable export and integrated it under `apps/studio` locally; the hosted repository was only read. UI dependencies are local workspace dependencies; no hosted repo was connected.
-   Tasks: build the initial Studio visual system and key screens in Lovable; export source/assets locally; record the prompt and design decisions.
-   Acceptance: local export is available for review; no hosted repository connection or deployment is used without separate approval.

### E13-T01 --- Design tokens

-   Priority: P0
-   Status: DONE
-   Evidence: Dark color, surface, typography, spacing, border, radius, and motion tokens are centralized in `apps/studio/src/styles.css`.
-   Define colors, spacing, typography, radii, borders, shadows, motion.
-   Acceptance: tokens are centralized.

### E13-T02 --- App shell

-   Priority: P0
-   Status: DONE
-   Evidence: Responsive seven-route shell, navigation, command palette, footer status, and mobile navigation sheet are integrated in `apps/studio/src/components/atlas/AppShell.tsx`.
-   Navigation, responsive layout, page container, header, status area.
-   Acceptance: mobile and desktop layouts work.

### E13-T03 --- Component primitives

-   Priority: P0
-   Status: DONE
-   Evidence: Shared buttons, panels, pills, banners, copy controls, input treatments, command palette, mobile sheet, and selects are integrated. Clipboard failures now display feedback.
-   Buttons, inputs, tabs, badges, code blocks, tables, tooltips,
    dialogs.
-   Acceptance: consistent variants and accessible states.

### E13-T04 --- Typography and code treatment
-   Priority: P0
-   Status: DONE
-   Evidence: Shared sans/monospace styles and safe hash/signature wrapping are defined in the Studio theme and primitives.
-   Define prose and monospaced styles; wrapping/truncation behavior.
-   Acceptance: long hashes and signatures remain usable.

### E13-T05 --- Motion and accessibility
-   Priority: P0
-   Status: DONE
-   Evidence: Visible focus styles, semantic input labels, reduced-motion CSS, responsive layouts, mobile navigation, and the Ctrl+K command palette were verified in source and the local production browser.
-   Add restrained transitions; reduced motion; focus states; keyboard
    behavior.
-   Acceptance: keyboard and reduced-motion checks pass.

------------------------------------------------------------------------

## EPIC E14 --- Studio workflows

**Goal:** Make core functionality discoverable and useful in the
browser.

### E14-T01 --- Landing/workspace

-   Priority: P0
-   Status: DONE
-   Evidence: Workspace presents Explorer/Decoder actions, explains ATLAS capabilities, reports backend-unconfigured state honestly, and has no fabricated metrics.
-   Explain product clearly; direct users to search/decode; no fake
    metrics.
-   Acceptance: main action visible quickly.

### E14-T02 --- Signature Explorer

-   Priority: P0
-   Status: IN_PROGRESS
-   Evidence: Selector/signature search, shared-schema response validation, provenance, collision handling, empty/error states, and opt-in sample preview are integrated and tested. Real API verification is blocked until the API exists.
-   Search selector/signature; candidates; provenance; empty/error
    states.
-   Acceptance: live API data displayed.

### E14-T03 --- Calldata Decoder

-   Priority: P0
-   Status: IN_PROGRESS
-   Evidence: Local calldata validation/selector extraction, shared-schema decode outcomes, per-candidate results, and explicit unavailable/error states are integrated and tested. Real API verification is blocked until the API exists.
-   Input, validation, decode results, ambiguity, copy JSON.
-   Acceptance: end-to-end real Arkiv-backed flow works.

### E14-T04 --- Event Inspector

-   Priority: P1
-   Topics/data input and event decode.
-   Acceptance: live event data and indexed argument display.

### E14-T05 --- Transaction Lab

-   Priority: P1
-   Chain/hash input, RPC facts, decoded input/logs, report export.
-   Acceptance: clear evidence source labels.

### E14-T06 --- API/SDK docs

-   Priority: P1
-   Code examples, endpoint reference, CLI install.
-   Acceptance: examples compile or are explicitly labeled illustrative.

### E14-T07 --- Responsive and empty/error states

-   Priority: P0
-   Mobile layouts, loading, no result, ambiguous, unavailable,
    malformed.
-   Acceptance: all states tested.

### E14-T08 --- Visual polish

-   Priority: P0
-   Spacing, typography, micro-interactions, performance, visual
    regression review.
-   Acceptance: no decorative interaction is nonfunctional.

------------------------------------------------------------------------

## EPIC E15 --- Community observations (optional)

**Goal:** Enable user contributions without weakening canonical data
trust.

### E15-T01 --- Observation schema

-   Priority: P2
-   Implement schema and owner metadata.
-   Acceptance: separate from canonical entities.

### E15-T02 --- Wallet authorization

-   Priority: P2
-   Verify signed challenge or equivalent supported mechanism.
-   Acceptance: server derives signer; never trusts supplied owner.

### E15-T03 --- Evidence validation

-   Priority: P2
-   Validate identifier/signature shape and evidence URL format.
-   Acceptance: invalid submissions rejected.

### E15-T04 --- Publish flow

-   Priority: P2
-   Write unverified observation with expiry if supported.
-   Acceptance: entity owner and key captured.

### E15-T05 --- Display and moderation

-   Priority: P2
-   Label unverified; show submitter and evidence; moderation status.
-   Acceptance: never merged into canonical results automatically.

------------------------------------------------------------------------

## EPIC E16 --- Documentation and judging evidence

**Goal:** Make the project independently understandable and verifiable.

### E16-T01 --- README

-   Priority: P0
-   Product overview, architecture, prerequisites, setup, commands,
    environment, demo.
-   Acceptance: clean clone setup succeeds.

### E16-T02 --- Arkiv schema documentation

-   Priority: P0
-   Logical schema, actual schema definitions, indexes, ownership,
    expiry.
-   Acceptance: matches code.

### E16-T03 --- Arkiv friction documentation

-   Priority: P0
-   Record actual friction, SDK/version, reproduction, workaround,
    resolution.
-   Acceptance: no invented complaints.

### E16-T04 --- Reach documentation

-   Priority: P0
-   Explain users, integration surfaces, adoption pathway, realistic
    reach.
-   Acceptance: no unsupported adoption claims.

### E16-T05 --- Why Arkiv documentation

-   Priority: P0
-   Explain public queryability, ownership, composability, lifecycle,
    tradeoffs.
-   Acceptance: explains why not just a private DB.

### E16-T06 --- Data quality documentation

-   Priority: P0
-   Source, license, importer, snapshot, validation, metrics,
    collisions, freshness.
-   Acceptance: numbers are generated from real import reports.

### E16-T07 --- AI usage and license

-   Priority: P0
-   Disclose AI assistance; preserve upstream attribution/license
    obligations.
-   Acceptance: all source licenses checked.

### E16-T08 --- Demo script

-   Priority: P0
-   Rehearse real mirror, lookup, decode, CLI, SDK/API, optional
    transaction investigation.
-   Acceptance: demo works from a clean deployed/local environment.

------------------------------------------------------------------------

## EPIC E17 --- Security and reliability

**Goal:** Protect keys, public endpoints, and data integrity.

### E17-T01 --- Secret management

-   Priority: P0
-   Verify env handling, ignore files, build-time leakage checks.
-   Acceptance: no private key in client bundle or repository.

### E17-T02 --- API abuse controls

-   Priority: P0
-   Rate limits, body limits, timeouts, CORS policy.
-   Acceptance: load/abuse tests behave predictably.

### E17-T03 --- Input hardening

-   Priority: P0
-   Hex bounds, URL validation, address validation, payload limits.
-   Acceptance: malformed/oversized inputs rejected.

### E17-T04 --- Retry policy

-   Priority: P0
-   Bounded retry for safe operations; no blind retry of non-idempotent
    writes.
-   Acceptance: retry behavior documented and tested.

### E17-T05 --- Dependency health

-   Priority: P0
-   Health/readiness distinction; dependency diagnostics.
-   Acceptance: unavailable Arkiv is not reported as healthy.

### E17-T06 --- Logging and redaction

-   Priority: P0
-   Structured logs, request IDs, no secret/header leakage.
-   Acceptance: log audit passes.

------------------------------------------------------------------------

## EPIC E18 --- Testing and release engineering

**Goal:** Prove correctness and make builds reproducible.

### E18-T01 --- Unit test coverage

-   Priority: P0
-   Status: SUCCESS with open gaps
-   Evidence: 92 test executions (73 distinct): schemas 19, arkiv 15, importer 28, Studio 30 (11 Studio-specific + 19 re-run schemas). Critical covered behavior: branded-type normalization, hashes, result/error contracts, creator filtering, record-hash lookup, keyset pagination, ABI canonicalization, selector/topic vectors, dedupe/collisions, manifests, idempotent writes and read-back, CLI exit codes, Studio API states and all seven routes. Core, decoder, API, SDK, CLI and chain tests do not exist because those packages do not.
-   Core, schemas, importer normalization, decoder, error mapping.
-   Acceptance: critical domain behavior covered.

### E18-T02 --- Arkiv integration tests

-   Priority: P0
-   Real Rabdi write/read/owner/pagination test where feasible.
-   Acceptance: test results recorded; test wallet funded/configured
    safely.

### E18-T03 --- API tests

-   Priority: P0
-   Request validation, lookup, decode, error cases, limits.
-   Acceptance: stable contracts asserted.

### E18-T04 --- SDK tests

-   Priority: P0
-   Transport, parsing, timeout, error mapping.
-   Acceptance: example consumer compiles.

### E18-T05 --- CLI tests

-   Priority: P0
-   stdout/stderr, exit codes, JSON, invalid input.
-   Acceptance: shell-level assertions pass.

### E18-T06 --- Studio E2E

-   Priority: P0
-   Lookup, decode, empty/error/ambiguous states.
-   Acceptance: Playwright suite passes.

### E18-T07 --- CI

-   Priority: P0
-   Install, lint, typecheck, tests, build.
-   Acceptance: pull request checks run.

### E18-T08 --- Release smoke test

-   Priority: P0
-   Clean install, env validation, health, real lookup, CLI, Studio.
-   Acceptance: checklist signed off.

------------------------------------------------------------------------

## EPIC E19 --- Approved public repository, deployment, and demo readiness

**Hard gate:** all tasks in this epic are blocked until the user explicitly approves the relevant action. Approval must be obtained separately for hosted repository creation, first push, and each deployment target.

**Goal:** Make the MVP accessible and reliable for judging.

### E19-T00 --- Create hosted repository (approval required)
-   Priority: P0
-   Tasks: present repository owner/name/visibility, contents, license, and secret scan results; ask for explicit approval; create only after approval.
-   Acceptance: remote repository exists only after recorded user approval.

### E19-T00A --- First push (approval required)
-   Priority: P0
-   Tasks: inspect staged file list, scan for secrets and generated artifacts, show intended branch and remote, ask for explicit approval, then push.
-   Acceptance: first push occurs only after separate explicit approval.

### E19-T01 --- Studio deployment (approval required)

-   Priority: P0
-   Configure host, env, build, domain/URL.
-   Acceptance: deployed Studio loads.

### E19-T02 --- API deployment (approval required)

-   Priority: P0
-   Deploy Node service; health/readiness; CORS; secrets.
-   Acceptance: public API serves real lookup.

### E19-T03 --- Arkiv production-like configuration (approval required)

-   Priority: P0
-   Confirm Rabdi network and importer wallet; no accidental mainnet
    writes.
-   Acceptance: deployed API queries expected network.

### E19-T04 --- Import and verification (public writes require approval)

-   Priority: P0
-   Run final import; read back; publish report.
-   Acceptance: counts and hashes verified.

### E19-T05 --- CLI release artifact (publication requires approval)

-   Priority: P0
-   Publish or provide reproducible install/run instructions.
-   Acceptance: another machine can run it.

### E19-T06 --- Demo dataset and examples

-   Priority: P0
-   Select real selectors, calldata, event and transaction examples.
-   Acceptance: each example independently verified.

### E19-T07 --- Demo rehearsal

-   Priority: P0
-   Rehearse short and long demos; prepare fallback
    recording/screenshots only as backup, clearly labeled.
-   Acceptance: live Arkiv query shown in primary demo.

### E19-T08 --- Final submission audit

-   Priority: P0
-   README, required docs, license, AI disclosure, links, build,
    deployed URLs.
-   Acceptance: no missing mandatory artifact.

------------------------------------------------------------------------

## EPIC E20 --- Post-MVP hardening and roadmap

**Goal:** Preserve a clean path beyond the hackathon without expanding
MVP scope prematurely.

### E20-T01 --- Known limitations register

-   Priority: P1
-   Record source coverage, RPC limitations, query limitations,
    ambiguity semantics.
-   Acceptance: limitations are public and accurate.

### E20-T02 --- Performance baseline

-   Priority: P1
-   Measure lookup/decode latency and query cost; establish baseline.
-   Acceptance: measurements are reproducible.

### E20-T03 --- Caching strategy

-   Priority: P2
-   Design cache with source/version awareness and no stale provenance.
-   Acceptance: cache invalidation strategy documented before
    implementation.

### E20-T04 --- Additional chain support

-   Priority: P2
-   Add chain configs and RPC tests.
-   Acceptance: each chain is verified independently.

### E20-T05 --- Additional signature sources

-   Priority: P2
-   Evaluate custom error and ABI sources; review license and quality.
-   Acceptance: source provenance and terms documented.

### E20-T06 --- Community contribution workflow

-   Priority: P2
-   Moderation, evidence, verification and expiry.
-   Acceptance: trust model reviewed.

### E20-T07 --- Adoption integrations

-   Priority: P2
-   Wallet, explorer, debugger or CI examples.
-   Acceptance: at least one external integration example.

### E20-T08 --- Versioning and compatibility

-   Priority: P1
-   API/SDK semver, schema evolution, migration notes.
-   Acceptance: compatibility policy documented.

------------------------------------------------------------------------


## EPIC E21 — ETHGlobal qualification and provenance gates

**Goal:** Ensure the project meets the Mirror-track qualification requirements shown in the sponsor instructions.

### E21-T01 — Built-from-scratch evidence
- Priority: P0
- Keep project work and meaningful Git history within ETHGlobal Mumbai rules; document AI use.
- Acceptance: repository history and AI_USAGE.md are ready for review.

### E21-T02 — Source license verification
- Priority: P0
- Use https://github.com/ethereum-lists/4bytes as the initial function-signature source; verify its MIT license in the repository.
- Link the source repository and license in README.
- Acceptance: README contains direct source and license links; imported data retains attribution.

### E21-T03 — Sourcify exclusion audit
- Priority: P0
- Audit every upstream source and transformation for Sourcify-derived data.
- Reject mixed-provenance sources that cannot exclude Sourcify records.
- Acceptance: data-quality.md documents source provenance and explicit exclusion; no Sourcify source is used.

### E21-T04 — Re-runnable importer proof
- Priority: P0
- Commit importer code; document exact commands; pin source commit; provide dry-run, import, and verify commands.
- Acceptance: a clean environment can rerun the importer with its own valid credentials.

### E21-T05 — Submission qualification audit
- Priority: P0
- Verify built-from-scratch compliance, license link, Sourcify exclusion, and importer reproducibility.
- Acceptance: all qualification checks are evidenced in README and repository artifacts.


## 21. Backlog execution record

For each task, append:

``` text
Task ID:
Status:
Owner/Agent:
Started:
Completed:
Changed files:
Commands executed:
Test/build result:
Manual verification:
Commit/PR:
Known limitations:
Next task:
```

### Phase 01 --- Local workspace foundation

- **Task IDs:** E01-T01 through E01-T05
- **Status:** DONE
- **Owner/Agent:** Copilot
- **Changed files:** Root workspace/tooling configuration, workspace package manifests, `.env.example`, `.gitignore`, `README.md`, `docs/architecture.md`, `plan.md`, and this backlog.
- **Commands executed:** `pnpm install`; `pnpm install --frozen-lockfile`; `pnpm lint`; `pnpm format:check`; `pnpm typecheck`; `pnpm test`; `pnpm build`.
- **Results:** All commands pass. Vitest reports no test files, expected before implementation begins.
- **Manual verification:** Confirmed the workspace started with only `PRD.md`, `BACKLOG.md`, and `plan.md`; confirmed no Git repository was initialized and no external service was contacted.
- **Commit/PR:** None; development remains local-only.
- **Known limitations:** No application source or runtime integration configuration exists yet. Package-specific TypeScript configs and environment validation will be added with their source/configuration.
- **Next task:** Phase 02 --- Domain types and validation.

### User-directed Lovable Studio integration (Phase 16 work performed early)

- **Task IDs:** E13-T00 through E13-T05; E14-T01; plan items 16.01--16.04 and 16.07
- **Status:** IN_PROGRESS (backend-backed Explorer/Decoder, a11y/browser checks, and visual E2E remain open)
- **Owner/Agent:** Copilot
- **Changed files:** Integrated the public reference UI under `apps/studio`; added local Vite, TanStack Router, Tailwind, React, Radix, and test configuration; aligned the Studio API client and sample fixtures with `packages/schemas`; added Studio setup documentation and updated the root scripts/README.
- **Commands executed:** `pnpm install --frozen-lockfile`; `pnpm lint`; `pnpm format:check`; `pnpm typecheck`; `pnpm test`; `pnpm build`; `pnpm --filter @atlas/studio preview -- --port 4173`; `Invoke-WebRequest http://127.0.0.1:4173/`.
- **Results:** Frozen install, lint, formatting, typecheck, 48 tests, and production build pass. All seven routes return HTTP 200.
- **Manual verification:** Confirmed the source repository is public; no Git repository was initialized locally and no remote was added. Browser verified each route's heading/title, mobile navigation, and Ctrl+K command palette. UI is integrated with live calls disabled by default; sample results are opt-in and labeled as not live.
- **Commit/PR:** None; development remains local-only.
- **Known limitations:** Real API, Arkiv, and RPC integrations are not yet implemented, so live API-backed Explorer/Decoder acceptance is blocked. Build reports a non-blocking 559 kB uncompressed main chunk warning.
- **Next task:** Continue the sequential engineering plan at Phase 03.

### 2026-11-06 --- Full workspace audit and importer build

- **Task IDs:** E03-T05/T06/T08, E04-T02..T12, E18-T01, plan 03, 04, 05A, 16
- **Status:** DONE (audit + offline importer); live import remains approval-gated
- **Owner/Agent:** pi (verified independently of any prior assistant claim)
- **Changed files:** rewrote `importer/extractor.ts` into `importer/src` (sources, solidity, normalize, report, pipeline, write, cli + 28 tests); added `packages/arkiv` `findByRecordHash` and typed client annotations; extended root `typecheck`/`test`/`build` to every bundle; added Studio all-seven-routes test; corrected `docs/arkiv-verification.md` access-key nuance; new `docs/implementation-status.md`, `importer/README.md`; updated `docs/data-quality.md`, `README.md`, this backlog and `plan.md`.
- **Commands executed (all pass):** `pnpm install --frozen-lockfile`; `pnpm lint`; `pnpm format:check`; `pnpm typecheck`; `pnpm test` (92 executed / 73 distinct); `pnpm build`; Studio `preview` serving all seven routes HTTP 200; `node importer/dist/cli.js dry-run --source openzeppelin-contracts --source-dir importer/fixtures` (3 files, 12 declarations, 10 validated, 8 functions, 2 events, 2 duplicates, 3 rejected, 0 writes).
- **Manual verification:** importer dry-run output and manifest inspected; preview responses inspected byte-level; route-matching test added; no Arkiv credentials present and no network write performed; no Git operations performed.
- **Known limitations:** no live Arkiv verification; `core`/`api` absent so no end-to-end path yet (shortest remaining path documented in `docs/implementation-status.md` section 3); source-policy decision E04-T13 still open; checkpoint/resume not implemented.
- **Commit/PR:** None; development remains local-only.
- **Next task:** E04-T13 decision, then the two-file `core` resolver + `services/api` lookup/health path, then the approval-gated live import.

## 22. Definition of done for the whole product

ATLAS is complete when: 1. The P0 backlog is complete. 2. A real
source-to-Arkiv-to-query-to-decode path works. 3. API, SDK, CLI, and
Studio use shared contracts. 4. All critical tests and builds pass. 5.
The product does not fabricate data or hide ambiguity. 6. Deployment and
demo are verified. 7. Required Arkiv-track documentation is complete. 8.
Known limitations and future work are documented.


### E19-T09 --- Free-tier provider verification
-   Priority: P0
-   Tasks: compare current free-tier limits for Studio/API hosting; verify runtime, cold starts, bandwidth, build limits, secrets, and Arkiv/RPC connectivity.
-   Acceptance: provider decision and limitations documented; no paid resource enabled.

### E19-T10 --- Online surface completeness audit
-   Priority: P0
-   Tasks: verify Studio, API, health/readiness, API docs, and required public project information are online; verify CLI/SDK installation or documented access path.
-   Acceptance: all required online URLs and smoke-test evidence are recorded.

### E19-T11 --- Per-target deployment approval record
-   Priority: P0
-   Tasks: record the user's explicit approval for each named deployment target and the exact scope approved.
-   Acceptance: no deployment without a matching approval record.
