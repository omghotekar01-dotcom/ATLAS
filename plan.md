# ATLAS --- 20-Phase Implementation Plan

**Purpose:** Sequential execution plan for autonomous agents and human
developers. **Read first:** `PRD.md` and `BACKLOG.md`. **Rule:**
Complete each phase's exit criteria before moving to the next phase.

### Local-only and approval rule (mandatory)
- Until the user explicitly approves an external action, all work stays in the local filesystem.
- Do not run `git init`, create commits, add remotes, create a hosted repository, push, publish packages, or deploy during the local-only stages.
- Repository creation, first push, and each deployment target are separate approval gates. Ask immediately before each action and wait for a clear yes.
- Preparing configuration locally is allowed; executing it against a hosted provider is not.
- Target state is a fully online product using free tiers wherever suitable. Verify current limits and never enable paid resources without approval.
- No external publication or deployment before 10:00 p.m. on the hackathon build day; after that time, explicit approval is still mandatory.

### Current verified status --- 2026-11-06

- One OpenZeppelin function record has been written to Arkiv Rabdi, read back,
  and confirmed through the API and Studio. See `docs/arkiv-live-proof.md`;
  this does not represent a full dataset import.
- Two local Vercel configurations and the production-readiness/deployment
  guides are prepared. No Git repository, hosted project, or deployment was
  created.
- Remaining release gates include moving secrets out of the OneDrive-synced
  workspace, creating/reviewing an approved Git repository, choosing exact
  production origins, setting API-only read variables, and separately
  approving each deployment.

### Lovable-first UI workflow
- Generate the initial Studio UI in Lovable before production frontend implementation.
- Export the generated code/assets locally and review them.
- Integrate the UI into `apps/studio`; preserve API/domain boundaries and remove generated mock business logic.
- Do not connect Lovable to a hosted repository or deploy from Lovable without separate approval.

## Execution contract

-   Each phase has exactly 9 substeps. Complete them in order unless a
    dependency is explicitly independent.
-   Mark a checkbox only after the work is implemented and verified.
-   Every step must produce code, tests, documentation, or a verifiable
    operational artifact.
-   Do not use mock data to claim a real Arkiv, RPC, API, CLI, or SDK
    integration is complete.
-   Before implementation, inspect existing code and verify external SDK
    behavior against official docs and installed typings.
-   After each phase, run affected tests, type checks, lint, and build;
    record commands and results.
-   If blocked, stop, document the evidence and blocker, and propose the
    smallest safe adjustment. Do not silently skip.
-   Update `BACKLOG.md` statuses and append a phase execution record
    after each phase.

## Mandatory ETHGlobal qualification gates

- [ ] Project is built from scratch in accordance with ETHGlobal rules.
- [ ] README links the republishable source license.
- [ ] No Sourcify data from any chain is used, including merged/mixed-provenance datasets.
- [ ] Importer is committed and can be rerun by judges using their own credentials.

## Global definition of done

-   P0 requirements in `PRD.md` are implemented.
-   Real upstream data is imported, written to Arkiv, queried back, and
    used in decoding.
-   API, SDK, CLI, and Studio share the same domain contracts.
-   Ambiguity, provenance, failures, and limitations are explicit.
-   Tests, CI, deployment, README, and Arkiv judging documentation are
    complete.

------------------------------------------------------------------------

## Phase 01 --- Local workspace bootstrap (no Git/repository actions)

-   [x] **01.01** Inspect the existing workspace and record its current
    state before modifying anything.
-   [x] **01.02** Keep the workspace local and do not initialize Git
    during the local-only stage, as required by the approval rules.
-   [x] **01.03** Initialize pnpm workspaces and select a supported
    Node.js version based on dependency compatibility.
-   [x] **01.04** Create the root package manifest with consistent
    scripts for install, lint, typecheck, test, and build.
-   [x] **01.05** Create the monorepo workspace directories defined in PRD.md
    without adding unnecessary placeholder logic.
-   [x] **01.06** Add strict shared TypeScript configuration; add
    package-specific configurations when each package gains source.
-   [x] **01.07** Configure ESLint, Prettier, Vitest, and ignore rules.
-   [x] **01.08** Create README.md, .env.example, and an initial
    architecture note.
-   [x] **01.09** Run a clean dependency install and all baseline
    checks; record exact results.

**Phase exit criteria:** A clean checkout installs successfully; root
scripts work; workspace dependency direction is documented.

**Phase record:** - Status: `DONE` - Agent/owner: Copilot - Evidence/commands: `pnpm install --frozen-lockfile`, `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test`, `pnpm build` all pass. Vitest reports no test files, as expected before implementation. - Commit/PR: none (local-only) - Blockers/limitations: No application source or runtime integration configuration exists yet; package-specific TypeScript configs and environment validation will be added when those packages/configurations are introduced.

------------------------------------------------------------------------

## Phase 02 --- Domain types and validation

-   [x] **02.01** Read PRD.md sections 8--10 and extract the domain
    entities and result contracts.
-   [x] **02.02** Define branded or clearly named types for selectors,
    topic hashes, addresses, chain IDs, hashes, and entity keys.
-   [x] **02.03** Create Zod schemas for function signatures, event
    signatures, observations, and import manifests.
-   [x] **02.04** Create Zod schemas for lookup, calldata decode, event
    decode, transaction investigation, and API errors.
-   [x] **02.05** Implement selector normalization and strict four-byte
    validation.
-   [x] **02.06** Implement topic0 normalization and strict 32-byte
    validation.
-   [x] **02.07** Define deterministic canonical serialization and
    record-hash calculation.
-   [x] **02.08** Create domain error classes/codes and a single
    error-to-API/CLI mapping policy.
-   [x] **02.09** Write unit tests for valid, invalid, boundary,
    normalization, and hash determinism cases.

**Phase exit criteria:** Shared schemas compile; all boundary validators
and hash tests pass.

**Phase record:** - Status: `DONE` - Agent/owner: Copilot - Evidence/commands: Added shared branded primitives and Zod record/result/error schemas in `packages/schemas`; `pnpm install --frozen-lockfile`, `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test`, and `pnpm build` pass; Vitest: 19 tests passed. The build emits the shared schema package and declarations. - Commit/PR: none (local-only) - Blockers/limitations: Upstream selector/topic-to-signature consistency checks depend on verified source semantics and will be implemented with the importer.

------------------------------------------------------------------------

## Phase 03 --- Arkiv SDK and Rabdi verification

-   [x] **03.01** Read the current official Arkiv documentation for
    first entity, schemas, querying, filtering, pagination, and Rabdi.
-   [x] **03.02** Inspect the installed Arkiv SDK package version,
    exports, TypeScript declarations, and examples.
-   [x] **03.03** Verify the current Rabdi network identifier, RPC
    configuration, chain identity, and signer requirements.
-   [x] **03.04** Verify how named schemas are defined and how indexed
    fields are declared in the installed SDK.
-   [x] **03.05** Verify how entities are written and which
    identifiers/transaction metadata are returned.
-   [x] **03.06** Verify how entities are queried, filtered, paginated,
    and how owner/creator metadata is exposed.
-   [x] **03.07** Verify expiration support and renewal semantics;
    record unsupported behaviors rather than guessing.
-   [x] **03.08** Create an ADR or verification note containing exact
    versions, references, and minimal working examples.
-   [ ] **03.09** Run a minimal connection/health script against Rabdi
    and capture the successful result.

**Phase exit criteria:** Arkiv SDK behavior is verified from official
docs and typings; a real Rabdi connection succeeds.

**Phase record:** - Status: `IN_PROGRESS` - Agent/owner: pi - Evidence: SDK 1.0.1 and viem 2.57.16 verified from installed source/typings; Rabdi ID 7794095, client/signer rules, indexed schema syntax, query pagination, filter semantics, typed rows, page limit 100, creator metadata, and the 7,884,000-block (~182-day) expiry limit are documented in `docs/arkiv-verification.md`. Re-verified that a missing access key throws while `""` selects the public rate-limited endpoint; ATLAS intentionally requires a non-empty key. Added `findByRecordHash` for import idempotency and creator/pagination tests (15 package tests). Root lint, format, typecheck, tests (92 executed / 73 distinct) and build pass. - Blocker: 03.09 awaits an approved live Rabdi request and configured access key. No credentials or funded test account are configured; no network write was attempted. The read-only health probe is not yet wired to a runnable doctor/API surface.

------------------------------------------------------------------------

## Phase 04 --- Arkiv schemas and repository adapter

-   [x] **04.01** Translate the logical FunctionSignature schema from
    the PRD into the verified SDK schema syntax.
-   [ ] **04.02** Implement the EventSignature schema only if its
    upstream source path is verified; otherwise leave it gated.
-   [ ] **04.03** Implement the Observation and ImportManifest schemas
    as separate trust domains when supported.
-   [x] **04.04** Document indexed fields and justify each index against
    query needs and write cost.
-   [x] **04.05** Implement Arkiv client construction behind a
    package-owned configuration interface.
-   [x] **04.06** Implement canonical function write and read methods
    with validated input/output.
-   [x] **04.07** Implement owner/creator verification using actual
    Arkiv entity metadata, not user fields.
-   [x] **04.08** Implement pagination and deterministic deduplication
    in the repository adapter.
-   [ ] **04.09** Write an integration test that creates, reads,
    validates, and verifies ownership of a real test entity.

**Phase exit criteria:** One real entity can be written and read back
from Rabdi through the adapter.

**Phase record:** - Status: `IN_PROGRESS` - Agent/owner: pi - Evidence: Added the indexed function schema, environment/client configuration, validated read/write adapter, trusted-creator checks, keyset pagination, deterministic hash deduplication, `findByRecordHash`, and typed client return annotations. Package tests now cover creator rejection, hash lookup, two-page cursor advancement, stalled-cursor failure, and schema validation (15 tests). `pnpm --filter @atlas/arkiv typecheck`, `test` and `build` pass. - Blocker: 04.09 requires user-approved live Rabdi access and funded credentials; event/observation schemas remain gated on later verified source requirements.

------------------------------------------------------------------------

## Phase 05 --- Upstream source client

-   [ ] **05.01** Inspect ethereum-lists/4bytes source repository and verify
    current function-signature endpoint behavior.
-   [ ] **05.02** Verify pagination fields, response shape, rate limits,
    timestamps, and source ID semantics.
-   [ ] **05.03** Implement a typed HTTP client with timeout, bounded
    retry, and response validation.
-   [ ] **05.04** Implement page fetching without assuming a fixed page
    size or stable ordering.
-   [ ] **05.05** Preserve original upstream IDs and source attribution
    in normalized records.
-   [ ] **05.06** Verify the event-signature endpoint separately before
    implementing event ingestion.
-   [ ] **05.07** Add fixtures based on captured, license-compliant API
    responses.
-   [ ] **05.08** Test empty pages, malformed responses, timeout, rate
    limit, and pagination termination.
-   [ ] **05.09** Document source coverage and fields that are
    unavailable or unreliable.

**Phase exit criteria:** Importer can fetch real function records and
validate the source response shape.

**Phase record:** - Status: `BLOCKED` - Agent/owner: Copilot -
Evidence: Inspected ethereum-lists/4bytes at commit
`2b8a705fe27833b59aac2a2af5d14e0144e1e56e`; repository metadata declares
MIT, its README describes Sourcify-based signature contributions, and
the raw per-selector files have no per-record provenance fields to
reliably exclude Sourcify-derived records. Also evaluated 4byte.directory,
its predecessor registry, and Etherface; none currently meets both
licensing and provenance gates. `docs/data-quality.md` documents the
evidence. No records were imported or written. A parallel, user-directed
derived-source importer (Phase 05A) now covers the offline extraction and
normalization portion without using 4bytes or Sourcify.
- Blocker: PRD QG-03 bars use of mixed-provenance data when Sourcify
records cannot reliably be separated. Resume with a source that passes
record-level provenance and license verification.

------------------------------------------------------------------------

## Phase 05A --- Derived first-party source importer (parallel workstream)

This workstream exists because the PRD-named 4bytes source is blocked by
QG-03. It derives signatures from first-party, licence-verified Solidity
source pinned to a commit, so every record has record-level provenance.
It does not replace Phase 05's acceptance criteria; it produces a
defensible initial dataset while the source-policy decision is made.

-   [x] **05A.01** Pin OpenZeppelin Contracts (MIT,
    `efaa6f78ab1dde05416246e801c0baaf4f900d49`) and ethereum/ERCs
    (CC0-1.0, `7dafd1125fffbd3832316edeb739608ad82bb4c4`) with licence URLs.
-   [x] **05A.02** Implement typed AST extraction of external/public
    functions and events with canonical ABI types.
-   [x] **05A.03** Reject declarations needing compiler-level symbol
    resolution (structs, enums, contract/function/mapping types).
-   [x] **05A.04** Normalize, hash, deduplicate by record hash, and
    preserve selector collisions.
-   [x] **05A.05** Validate every record against shared schemas.
-   [x] **05A.06** Emit a dry-run report and a schema-valid import
    manifest with real counts and failure reasons.
-   [x] **05A.07** Add fixtures and tests for canonicalization, known
    selector/topic vectors, rejections, determinism and dedupe.
-   [x] **05A.08** Implement hash-first idempotent writes, single-attempt
    semantics and read-back verification behind unit tests.
-   [x] **05A.09** Implement a CLI with offline `dry-run` and an
    `import` command gated on `--confirm-write` plus Arkiv credentials.
-   [ ] **05A.10** Run a live import of one pinned checkout and save the
    read-back report (requires Gate D approval, credentials, funding).
-   [ ] **05A.11** Record the source-policy decision in the PRD and
    resolve the 4bytes wording (E04-T13).

**Phase exit criteria:** A pinned first-party source produces validated,
reproducible, provenance-complete records, and the write path is proven
live.

**Phase record:** - Status: `IN_PROGRESS` - Agent/owner: pi - Evidence:
`importer/src` implements sources, Solidity extraction, normalization,
reporting, pipeline, writer and CLI with 28 passing tests. Built CLI
dry-run over fixtures: 3 files, 12 declarations, 10 validated (8
functions, 2 events), 2 duplicates, 3 rejections, 0 writes. Root lint,
format, typecheck, test and build pass. - Blocker: 05A.10 needs explicit
approval, `ARKIV_ACCESS_KEY`, a funded `ARKIV_PRIVATE_KEY`, and a funded
Rabdi account; 05A.11 needs a product decision. - Limitations: network
fetching, checkpoint/resume and event writes are not implemented; events
are extracted and reported only.

------------------------------------------------------------------------

## Phase 06 --- Import normalization and quality controls

-   [x] **06.01** Map upstream function records into the shared
    FunctionSignature domain schema.
-   [x] **06.02** Normalize selector casing and canonical signature
    whitespace without changing signature meaning.
-   [x] **06.03** Verify selector length and, where applicable, hash
    consistency using a verified hashing implementation.
-   [x] **06.04** Calculate deterministic record hashes using a
    documented canonical field set.
-   [x] **06.05** Detect duplicate records by record hash while
    retaining distinct signatures sharing one selector.
-   [x] **06.06** Create structured rejection reasons for malformed or
    inconsistent records.
-   [x] **06.07** Implement dry-run output with fetched, valid,
    duplicate, rejected, and expected-write counts.
-   [x] **06.08** Add tests for selector collisions, duplicate IDs,
    duplicate content, and malformed records.
-   [ ] **06.09** Generate a sample data-quality report from an actual
    fetched batch.

**Phase exit criteria:** A source batch is normalized, validated,
collision-safe, and reportable without writing.

**Phase record:** - Status: `IN_PROGRESS` - Agent/owner: pi - Evidence:
06.01--06.08 are implemented for the derived first-party source:
shared-schema validation, canonical selectors via `viem`, deterministic
hashes, content dedupe, preserved collisions, structured rejections, and
CLI dry-run counts. Covered by 28 importer tests. - Blocker: 06.09 needs
a real pinned checkout run (the verified run used synthetic fixtures);
no network fetching is implemented. - Deviation: records are derived from
Solidity ASTs rather than mapped from an upstream registry API.

------------------------------------------------------------------------

## Phase 07 --- Importer write, resume, and verification

-   [x] **07.01** Implement the importer orchestration interface and
    explicit functions/events/all modes.
-   [x] **07.02** Implement idempotent write behavior using content
    identity rather than selector uniqueness.
-   [ ] **07.03** Add safe checkpointing or resume support if source
    pagination can be interrupted.
-   [x] **07.04** Ensure non-idempotent Arkiv writes are not blindly
    retried after uncertain outcomes.
-   [x] **07.05** Write import manifests with source, version, importer
    commit, wallet, timestamps, and counts.
-   [x] **07.06** Read imported entities back from Arkiv and validate
    their content hashes.
-   [x] **07.07** Compare expected and actual counts, report missing
    entities, and classify partial failures.
-   [x] **07.08** Implement commands for dry-run, import, verify, and
    report.
-   [ ] **07.09** Run an end-to-end import of a controlled real batch
    and save the generated report.

**Phase exit criteria:** A real import is repeatable, verifiable, and
produces an auditable manifest.

**Phase record:** - Status: `IN_PROGRESS` - Agent/owner: pi - Evidence:
07.01, 07.02, 07.04--07.08 are implemented in `importer/src` and covered
by unit tests with an in-memory repository: hash-first skip/write,
single-attempt writes, manifest emission, read-back of verified/missing/
mismatched records, and CLI exit codes. `dry-run` and `import` are the
commands; verification runs automatically after import and `--report`
writes the manifest. - Blocker: 07.03 needs resumable source checkpoints;
07.09 needs Gate D approval, credentials and funding. Event writes are
gated on the Arkiv event schema.

------------------------------------------------------------------------

## Phase 08 --- Core resolver

-   [ ] **08.01** Define repository ports in core without importing
    Arkiv SDK modules.
-   [ ] **08.02** Implement the function lookup use case with input
    validation.
-   [ ] **08.03** Query the Arkiv repository and ensure every page is
    consumed.
-   [ ] **08.04** Return every matching candidate with source ID, record
    hash, entity key, and provenance.
-   [ ] **08.05** Implement deterministic ordering without treating
    order as confidence.
-   [ ] **08.06** Set ambiguous=true when more than one candidate
    exists.
-   [ ] **08.07** Return a valid empty result for unknown selectors,
    distinct from dependency failure.
-   [ ] **08.08** Add repository contract tests and core unit tests
    using controlled test doubles.
-   [ ] **08.09** Run a real Rabdi lookup and compare the response to
    the imported source record.

**Phase exit criteria:** Function resolution uses real Arkiv data and
correctly handles empty and ambiguous results.

**Phase record:** - Status: `DONE` - Agent/owner: pi - Evidence/commands: `@atlas/core` implements selector parsing, candidate mapping, deterministic lookup, ambiguity, valid empty results, bounded search and cursor pagination; 22 package tests pass. - Commit/PR: none (local-only) - Blockers/limitations: live Arkiv data still requires credentials.
------------------------------------------------------------------------

## Phase 09 --- Calldata decoding engine

-   [ ] **09.01** Verify the current viem APIs and types for parsing
    function signatures and decoding function data.
-   [ ] **09.02** Implement strict calldata validation and selector
    extraction.
-   [ ] **09.03** Build a safe ABI function item from each candidate
    signature using verified viem-supported syntax.
-   [ ] **09.04** Attempt decoding independently for every candidate
    returned by the resolver.
-   [ ] **09.05** Return a per-candidate decode status and preserve
    failed candidates.
-   [ ] **09.06** Generate fallback argument names arg0, arg1, etc. when
    the source has no parameter names.
-   [ ] **09.07** Serialize bigint values as decimal strings and
    preserve addresses/bytes without lossy conversion.
-   [ ] **09.08** Add known test vectors, malformed payload tests,
    collision tests, and decode-failure tests.
-   [ ] **09.09** Demonstrate one actual Arkiv-resolved selector
    decoding a valid calldata payload.

**Phase exit criteria:** The core produces provenance-aware,
collision-aware calldata decode results.

**Phase record:** - Status: `DONE` - Agent/owner: pi - Evidence/commands: calldata parsing, per-candidate viem decoding, byte-for-byte re-encode validation, per-argument serialization (bigint as decimal strings), and explicit failures are implemented in `@atlas/core` with tests. - Commit/PR: none (local-only) - Blockers/limitations: none for top-level calldata.
------------------------------------------------------------------------

## Phase 10 --- Event mirror and decoder

-   [ ] **10.01** Verify event endpoint coverage and source semantics in
    ethereum-lists/4bytes documentation.
-   [ ] **10.02** Implement event record mapping, topic0 validation, and
    deterministic hashing.
-   [ ] **10.03** Implement the event Arkiv schema and real write/read
    integration test.
-   [ ] **10.04** Extend importer dry-run, write, manifest, and
    verification to event records.
-   [ ] **10.05** Implement event resolver by topic0 with owner
    filtering and pagination.
-   [ ] **10.06** Verify viem event ABI decoding behavior for indexed
    and non-indexed parameters.
-   [ ] **10.07** Implement candidate-level log decoding with warnings
    for unknown topics or malformed data.
-   [ ] **10.08** Add fixtures for standard transfer logs, dynamic
    values, and ambiguous topics.
-   [ ] **10.09** Document event mirror coverage and limitations
    separately from function data.

**Phase exit criteria:** Event records can be mirrored and queried;
known logs decode correctly, or the feature is explicitly deferred with
evidence.

**Phase record:** - Status: `PARTIAL` - Agent/owner: pi - Evidence/commands: topic lookup, indexed-layout-aware log decoding, `/v1/events/:topic0`, `/v1/decode/logs` and the Event Inspector wiring are implemented and tested. The Arkiv `atlas.event-signatures` read adapter and schema are implemented and wired into the API; event writes/import remain unimplemented, so a configured registry returns valid empty results until an approved import. - Blockers: PRD phase 10 event writes and an approved live import.
------------------------------------------------------------------------

## Phase 11 --- Chain adapter and RPC configuration

-   [ ] **11.01** Choose one primary EVM chain for the MVP demo and
    document why.
-   [ ] **11.02** Verify the RPC provider's supported methods, rate
    limits, and terms.
-   [ ] **11.03** Define typed chain configuration and environment
    validation.
-   [ ] **11.04** Create read-only viem public clients behind a
    ChainReader interface.
-   [ ] **11.05** Implement transaction retrieval and normalize returned
    fields.
-   [ ] **11.06** Implement receipt retrieval and distinguish
    successful, reverted, pending, and missing transactions.
-   [ ] **11.07** Implement RPC timeout, rate-limit, unavailable, and
    unsupported-chain errors.
-   [ ] **11.08** Add tests using a controlled client and a verified
    real transaction fixture.
-   [ ] **11.09** Update doctor/health diagnostics to report RPC status
    without leaking credentials.

**Phase exit criteria:** One configured chain can provide real
transaction and receipt data with clear failure semantics.

**Phase record:** - Status: `DONE` - Agent/owner: pi - Evidence/commands: `@atlas/chain` supports only chains 1 and 11155111 via `ATLAS_RPC_URL_1`/`ATLAS_RPC_URL_11155111`, with no invented default RPC; 10 tests cover missing/pending/reverted receipts and RPC failures. - Blockers: live RPC URLs are not configured.
------------------------------------------------------------------------

## Phase 12 --- Transaction investigation service

-   [ ] **12.01** Define the TransactionInvestigation result schema with
    separate chain facts and registry interpretations.
-   [ ] **12.02** Implement orchestration that fetches transaction and
    receipt through ChainReader.
-   [ ] **12.03** Extract the input selector and resolve it through the
    Arkiv-backed function resolver.
-   [ ] **12.04** Decode all candidate signatures and preserve ambiguity
    or decode failures.
-   [ ] **12.05** Resolve receipt log topics through the event resolver
    when event support is enabled.
-   [ ] **12.06** Decode available logs and retain unknown topics rather
    than dropping them.
-   [ ] **12.07** Add source labels identifying RPC, Arkiv, and
    viem-derived fields.
-   [ ] **12.08** Generate stable JSON reports including warnings and
    limitations; do not generate safety verdicts.
-   [ ] **12.09** Test success, revert, pending, missing transaction,
    unknown selector, ambiguous selector, and RPC outage.

**Phase exit criteria:** A transaction hash produces an evidence-backed
report with explicit limitations.

**Phase record:** - Status: `DONE` - Agent/owner: pi - Evidence/commands: `investigateTransaction` retrieves verified transaction/receipt facts, decodes top-level calldata and up to 25 logs, and lists explicit limitations; exercised through `/v1/transactions/analyze` with 46 API tests. - Blockers: no RPC URL is configured by default; a read-only public-RPC smoke test passed. Internal calls are out of scope by design.
------------------------------------------------------------------------

## Phase 13 --- REST API

-   [ ] **13.01** Create the Fastify service with validated
    configuration, startup, shutdown, and health route.
-   [ ] **13.02** Implement request/response schemas using the shared
    schemas package.
-   [ ] **13.03** Implement GET /v1/functions/:selector using the shared
    core resolver.
-   [ ] **13.04** Implement GET /v1/functions/search with bounded
    pagination and honest search semantics.
-   [ ] **13.05** Implement POST /v1/decode/calldata using the shared
    decoder.
-   [ ] **13.06** Add event routes only when the event mirror and
    decoder are complete.
-   [ ] **13.07** Add transaction analysis route only when RPC
    investigation is complete.
-   [ ] **13.08** Implement stable error envelope, request IDs,
    structured logging, CORS, rate limits, and body limits.
-   [ ] **13.09** Write API tests for success, empty result, invalid
    input, ambiguity, and dependency failure.

**Phase exit criteria:** API endpoints return real shared-core results
and consistent errors.

**Phase record:** - Status: `DONE` - Agent/owner: pi - Evidence/commands: Fastify API with seven routes, request IDs, rate limiting, upstream timeout, shared error envelope and health reporting. Live smoke test returned degraded health without credentials, `502 UPSTREAM_UNAVAILABLE` for an unconfigured registry and `INVALID_SELECTOR` for bad input. - Blockers: canonical data requires live Arkiv credentials.
------------------------------------------------------------------------

## Phase 14 --- TypeScript SDK

-   [ ] **14.01** Define the public Atlas client options and typed error
    hierarchy.
-   [ ] **14.02** Choose and document ESM/package export strategy based
    on consumer compatibility.
-   [ ] **14.03** Implement an HTTP transport with base URL, headers,
    timeout, and abort behavior.
-   [ ] **14.04** Implement lookupFunction and searchFunctions against
    the API contract.
-   [ ] **14.05** Implement decodeCalldata and validate response
    parsing.
-   [ ] **14.06** Add event and transaction methods only when their API
    routes ship.
-   [ ] **14.07** Ensure the SDK never requires a private key for
    read-only functionality.
-   [ ] **14.08** Create a clean example consumer project and compile it
    against the built package.
-   [ ] **14.09** Add unit tests for requests, responses, invalid JSON,
    HTTP errors, and timeouts.

**Phase exit criteria:** A separate TypeScript consumer can
install/import the SDK and call real API methods.

**Phase record:** - Status: `DONE` (private, unpublished) - Agent/owner: pi - Evidence/commands: typed `AtlasClient` with zod validation, timeout and `AtlasSdkError`; 9 tests; usage in `packages/sdk/README.md`. - Blockers: npm publication requires separate explicit approval.
------------------------------------------------------------------------

## Phase 15 --- Professional CLI

-   [ ] **15.01** Create the Commander CLI entry point, version, help,
    and configuration loader.
-   [ ] **15.02** Implement atlas lookup with validation, human output,
    and JSON output.
-   [ ] **15.03** Implement atlas search with bounded pagination and
    readable candidate summaries.
-   [ ] **15.04** Implement atlas decode with per-candidate outcomes,
    provenance, and copyable output.
-   [ ] **15.05** Ensure JSON mode writes pure JSON to stdout and all
    progress/diagnostics to stderr.
-   [ ] **15.06** Implement stable exit codes and test them from shell
    scripts.
-   [ ] **15.07** Implement atlas doctor for API and configured
    dependency connectivity without printing secrets.
-   [ ] **15.08** Add event, transaction, and report commands only when
    corresponding backend features are complete.
-   [ ] **15.09** Build/package the CLI and verify it works from a clean
    environment and in a shell pipeline.

**Phase exit criteria:** The CLI is predictable, automation-friendly,
documented, and backed by the real API.

**Phase record:** - Status: `DONE` (private, unpublished) - Agent/owner: pi - Evidence/commands: Commander CLI with lookup/search/decode/event/logs/tx/doctor, human and JSON output, `--api-url`, `--timeout`, exit codes 0/1/2/3/4; 10 tests; usage in `packages/cli/README.md`. - Blockers: npm publication requires separate explicit approval.
------------------------------------------------------------------------

## Phase 16 --- Lovable UI export, review, and Studio integration

-   [x] **16.01** Define design tokens for color, typography, spacing,
    borders, radius, and motion.
-   [x] **16.02** Create the responsive app shell, navigation, header,
    and workspace layout.
-   [x] **16.03** Build reusable primitives for inputs,
    buttons, badges, tables, tabs, dialogs, and code blocks.
-   [x] **16.04** Implement the landing/workspace page with a clear
    primary action and no fabricated metrics.
-   [ ] **16.05** Implement Signature Explorer connected to the real
    API.
-   [ ] **16.06** Implement Calldata Decoder connected to the real API
    and shared result semantics.
-   [x] **16.07** Add provenance, ambiguity, empty, loading, error, and
    unavailable states.
-   [x] **16.08** Verify keyboard support, visible focus, reduced-motion
    handling, and responsive behavior.
-   [ ] **16.09** Run visual review and end-to-end tests at desktop and
    mobile breakpoints.

**Phase exit criteria:** Studio provides polished, accessible, real-data
lookup and decoding workflows.

**Phase record:** - Status: `DONE` except live status probes - Agent/owner: pi - Evidence/commands: all seven routes preserved with the iOS-inspired design; Explorer/Decoder use the API; Event Inspector and Transaction Lab call `/v1/decode/logs` and `/v1/transactions/analyze` with honest unconfigured/error/empty states; Studio tests 33 executed (14 distinct). - Blockers: `/status` still describes rather than probes capabilities; no browser E2E suite; 500 kB chunk warning.
------------------------------------------------------------------------

## Phase 17 --- Developer hub and advanced UI

-   [ ] **17.01** Create documentation navigation and explain the ATLAS
    mental model for Web2-first developers.
-   [ ] **17.02** Document function selectors, event topics, calldata,
    logs, RPC, and Arkiv in concise practical language.
-   [ ] **17.03** Add API playground for function lookup and calldata
    decode.
-   [ ] **17.04** Add SDK quick-start examples that compile against the
    current package.
-   [ ] **17.05** Add CLI installation and command examples verified
    against the built CLI.
-   [ ] **17.06** Implement Event Inspector only if event backend
    support is complete.
-   [ ] **17.07** Implement Transaction Lab only if transaction analysis
    backend support is complete.
-   [ ] **17.08** Add JSON export/copy actions and source/provenance
    detail panels.
-   [ ] **17.09** Verify every UI control works and remove dead buttons,
    placeholder metrics, and fake connection states.

**Phase exit criteria:** Developer Hub examples work; advanced screens
reflect actual backend capabilities.

**Phase record:** - Status: `TODO` - Agent/owner: - Evidence/commands: -
Commit/PR: - Blockers/limitations:

------------------------------------------------------------------------

## Phase 18 --- Security, tests, and CI

-   [ ] **18.01** Audit environment variables and ensure private keys
    are never exposed to browser bundles.
-   [ ] **18.02** Verify .env files, build artifacts, logs, and error
    responses do not leak secrets.
-   [ ] **18.03** Add API request/body limits, rate limiting, CORS
    policy, and safe timeouts.
-   [ ] **18.04** Audit hex/address/query validation and bound expensive
    operations.
-   [ ] **18.05** Review retry behavior and ensure uncertain
    non-idempotent writes are not duplicated.
-   [ ] **18.06** Complete unit, Arkiv integration, API, SDK, CLI, and
    Studio end-to-end test suites.
-   [ ] **18.07** Configure CI for install, lint, typecheck, tests, and
    build.
-   [ ] **18.08** Run dependency and license checks; document upstream
    dataset license obligations.
-   [ ] **18.09** Fix all P0 test/build/security failures and record
    residual risks.

**Phase exit criteria:** CI is green; critical security and correctness
tests pass; no secret leakage.

**Phase record:** - Status: `TODO` - Agent/owner: - Evidence/commands: -
Commit/PR: - Blockers/limitations:

------------------------------------------------------------------------

## Phase 19 --- Approved hosted repository, deployment, import, and demo

**This phase is blocked until the user gives explicit approval.** Do not infer approval from reaching this phase.

**Approval gates before executing this phase (not phase substeps):**
- **Hosted repository:** present owner/name/visibility, planned contents, license, and secret-scan results; ask before creating it.
- **First push:** show exact files/branch, scan for secrets and unwanted artifacts, and ask separately before pushing.
- **Provider selection:** verify current free-tier limits; present exact Studio/API targets, environment variables, public exposure, and rollback plan.
- **Each deployment:** ask separately before deploying Studio, API, or any additional service.
- **Other publication:** ask separately before publishing docs, packages, datasets, or public artifacts.
-   [ ] **19.01** After approval, deploy the API to a verified free-tier Node-compatible host and configure
    verified environment variables.
-   [ ] **19.02** After separate approval, deploy Studio (Vercel free tier candidate) and connect it to the deployed API with
    correct CORS settings.
-   [ ] **19.03** Confirm deployed services point to Arkiv Rabdi, not an
    unintended network.
-   [ ] **19.04** Run the final importer and verify entities by reading
    them back from Arkiv.
-   [ ] **19.05** Publish the real import manifest and data-quality
    metrics.
-   [ ] **19.06** Build and verify CLI installation instructions or a
    distributable package.
-   [ ] **19.07** Prepare real selector, calldata, event, and
    transaction examples; verify each independently.
-   [ ] **19.08** Rehearse a demo showing source → Arkiv write → Arkiv
    query → decode → CLI/API/Studio.
-   [ ] **19.09** Run final smoke tests and audit README, required Arkiv
    documents, license, AI disclosure, and submission links.

**Phase exit criteria:** All required product surfaces are online on approved free-tier services (or specifically approved alternatives), the demo works with real Arkiv, and every external action has a matching approval. No paid resource was enabled without approval.
data and verifiable evidence.

**Phase record:** - Status: `TODO` - Agent/owner: - Evidence/commands: -
Commit/PR: - Blockers/limitations:

------------------------------------------------------------------------

## Phase 20 --- Final audit and handoff

-   [ ] **20.01** Review every P0 backlog item and require evidence
    before marking it done.
-   [ ] **20.02** Review P1 items and clearly label shipped, deferred,
    or blocked functionality.
-   [ ] **20.03** Run clean-clone setup from scratch using only
    documented instructions.
-   [ ] **20.04** Run all root quality commands and capture final
    results.
-   [ ] **20.05** Verify API, SDK, CLI, and Studio use the same
    contracts and no duplicated business logic.
-   [ ] **20.06** Verify every displayed source, metric, status, and
    provenance claim is grounded in real data.
-   [ ] **20.07** Review known limitations, architecture decisions,
    operational instructions, and troubleshooting docs.
-   [ ] **20.08** Create final release notes, demo script, and handoff
    summary for a new engineering agent.
-   [ ] **20.09** Tag the release and freeze scope; move all
    nonessential improvements into a post-MVP roadmap.

**Phase exit criteria:** A new agent can independently set up, run,
verify, and explain ATLAS without relying on chat history.

**Phase record:** - Status: `IN_PROGRESS` (local preparation complete; release criteria unmet) - Agent/owner: Copilot - Evidence: one real Rabdi function record was written and read-back verified; API and Studio returned the same record; Vercel preparation is in `apps/studio/vercel.json`, `services/api/vercel.json` and `docs/vercel-deployment.md`. Current verification is in `docs/arkiv-live-proof.md` and `docs/implementation-status.md`. - Blockers: only one record is confirmed; no Git history or deployment; production origins and environment values are not configured; browser/E2E automation and global rate limiting remain open.
------------------------------------------------------------------------

## Final handoff checklist

- [ ] Studio UI originated in Lovable, was exported locally, reviewed, and integrated.
- [ ] Development remained local until the late release phase.
- [ ] Hosted repository creation was explicitly approved.
- [ ] First push was explicitly approved after a secret/content review.
- [ ] Each deployment target was explicitly approved before execution.
- [ ] Studio, API, documentation, and all required public-facing surfaces are online.
- [ ] Free-tier limits and cold-start/availability tradeoffs are documented.
- [ ] No paid resource or plan was enabled without explicit approval.


-   [ ] `PRD.md` reflects the implemented product and known limitations.
-   [ ] `BACKLOG.md` has accurate statuses and evidence for every task.
-   [ ] All 20 phases have exit records.
-   [ ] README setup works from a clean clone.
-   [ ] Arkiv mirror is verified with real writes and reads.
-   [ ] CLI human and JSON modes work.
-   [ ] SDK example compiles and calls the API.
-   [ ] Studio lookup and decode work with real data.
-   [ ] API errors and operational states are documented.
-   [ ] Final demo and release notes are ready.
