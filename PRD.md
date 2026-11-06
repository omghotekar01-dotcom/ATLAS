# ATLAS --- Product Requirements Document (PRD)

**Document status:** Baseline specification for implementation\
**Product:** ATLAS\
**Track:** ETHGlobal --- Mirror Something Ethereum Depends On (Arkiv)\
**Version:** 1.0\
**Primary implementation language:** TypeScript\
**Primary network for the hackathon:** Arkiv Rabdi testnet\
**Audience:** Product, design, engineering, QA, and autonomous coding
agents

------------------------------------------------------------------------

## 0. Instructions for every agent

This document is the product source of truth. Read it before changing
code.

1.  Do not assume prior Web3 or Arkiv knowledge. Learn the relevant
    concepts from the official references listed below.
2.  Do not invent SDK methods, schema syntax, RPC capabilities,
    endpoints, transaction semantics, or environment variables. Verify
    them against the installed package typings and official
    documentation.
3.  Do not replace a required real integration with mock data and
    present it as complete.
4.  Do not silently fall back from Arkiv to a local file or upstream
    API. If an explicitly configured fallback exists, label its source
    in every result.
5.  Preserve the distinction between canonical mirrored records and
    community-submitted observations.
6.  Keep domain logic independent from Next.js, Fastify, CLI frameworks,
    and Arkiv SDK details.
7.  Make small, testable changes. Run the relevant tests, type checks,
    lint, and build after each meaningful change.
8.  Update `BACKLOG.md` and `plan.md` when work status changes. Do not
    mark a task complete without evidence.
9.  If a requirement cannot be implemented because an external SDK or
    service behaves differently than expected, document the verified
    behavior and propose the smallest compatible change. Do not guess.
10. Never commit secrets, private keys, access tokens, or real user
    credentials.

### Agent operating protocol

At the beginning of each task: - Read this PRD, `BACKLOG.md`, `plan.md`,
and the repository `README.md`. - Identify the current phase and backlog
item. - Inspect the existing implementation before editing. - State the
intended files, implementation approach, dependencies, and risks. -
Implement only the assigned scope unless a dependency blocks progress. -
Run tests and report exact commands and outcomes. - List changed files,
remaining work, known limitations, and the next recommended backlog
item.

At the end of each phase: - Verify every phase exit criterion. - Update
status and evidence in the backlog. - Update `plan.md` checkboxes. - Add
or update documentation. - Do not proceed past a failed gate.

------------------------------------------------------------------------


## 0A. Local-first development and explicit approval gates

**This is a hard execution constraint, not a preference.**

1. Until the user explicitly authorizes the relevant action, all development stays on the local machine in a local project directory.
2. Do not create a GitHub/GitLab/other hosted repository, publish a package, push code, create a pull request, or make any deployment before asking the user and receiving a clear yes for that specific action.
3. Do not run `git init`, create commits, add remotes, push branches, or publish tags during the local-only stage. Work in the local filesystem without committing. If local version control is later useful, ask first.
4. Reaching a planned phase is not permission. Before each external action, explain exactly what will be created or changed, the target service/account, the expected cost (including free-tier limits), secrets/permissions needed, and rollback implications; then ask for approval.
5. Approval is action-specific. Approval to create a GitHub repository does not authorize pushing code. Approval to push does not authorize deployment. Approval to deploy one service does not authorize deploying the others.
6. Never interpret silence, a previous approval, an agent's recommendation, or a phase checklist as consent.
7. Agents may prepare deployment configuration, Dockerfiles, environment-variable templates, build scripts, health checks, and deployment instructions locally. They must not execute deployment or publish anything without approval.
8. The target end state is a fully online product: Studio, API, public data/API access, documentation, and any other user-facing component required for the demo should be reachable online. Prefer free tiers and free static hosting where technically suitable. Verify current limits and suitability before choosing providers; never promise permanent zero cost or bypass provider limits.
9. If a component cannot be hosted reliably on a free tier, explain the limitation and propose a free alternative or ask before using a paid service. Do not silently incur charges.
10. Before 10:00 p.m. on the hackathon build day, keep the project local-only: no hosted repository, commits, pushes, package publication, or deployments. After that time, the same explicit approval gates still apply.

### Required approval sequence

- **Gate A — Hosted repository:** ask before creating the remote repository.
- **Gate B — First push:** show what will be pushed, check for secrets and unwanted files, then ask before pushing.
- **Gate C — Each deployment target:** list the exact service, project, region, build settings, environment variables, data/network target, free-tier limits, and public URLs expected; ask before deploying that target.
- **Gate D — Data publication/import:** ask before any production/public-network write or public dataset publication that is not already explicitly authorized.
- **Gate E — Final public release:** ask before domain/DNS changes, package publication, public announcement, or final release.

A user may approve several named actions together, but the scope must be explicit. When in doubt, stop and ask.

## 0B. Lovable-first UI workflow

1. Create the initial Studio UI in **Lovable** before implementing the production frontend.
2. Treat Lovable output as the visual/interaction starting point, not as the source of truth for domain logic, API contracts, data access, or security.
3. Export or provide the Lovable-generated code/assets to the implementation workspace locally. Review its framework, dependencies, routes, components, responsive behavior, accessibility, and licensing before integration.
4. Integrate the UI into `apps/studio` while preserving the PRD's shared API contracts and architecture. Refactor generated components where needed; do not copy business logic into the frontend.
5. Do not connect Lovable to a hosted GitHub repository or publish/deploy from Lovable unless the user separately approves that exact action.
6. The implementation agents (ChatGPT/Astra or other coding agents) must receive the PRD, backlog, plan, and the exported Lovable UI. They should adapt the UI to the agreed contracts rather than redesigning the product without approval.

## 1. Product summary

ATLAS is an open EVM interaction intelligence product. It helps
developers identify, understand, decode, and investigate EVM contract
interactions using a public, provenance-aware signature registry
mirrored into Arkiv.

**Tagline:** Search. Decode. Investigate. Integrate.

**Core promise:** Given a function selector, event topic, calldata
payload, log, or supported transaction hash, ATLAS finds candidate
interpretations, decodes what can be decoded, and clearly shows the
evidence and limitations.

ATLAS is one product with four interfaces over shared capabilities:

1.  **ATLAS Studio:** minimalist web workspace.
2.  **ATLAS CLI:** professional command-line tool.
3.  **ATLAS SDK:** TypeScript integration package.
4.  **ATLAS REST API:** language-independent interface.

The registry is the foundation. The product must demonstrate a genuine
data pipeline from upstream source to Arkiv write, Arkiv query, and
usable decoding result.

## 2. Problem statement

EVM interactions are represented by low-level hexadecimal data.
Developers frequently need to determine: - Which function may correspond
to a four-byte selector. - Which event may correspond to a log topic. -
How to decode calldata and event arguments. - Whether a selector has
multiple possible signatures. - Where a candidate signature came from. -
How to integrate signature resolution into their own tooling. - How to
inspect a transaction using actual chain data without confusing chain
facts with signature-database interpretations.

Existing signature registries are useful but do not by themselves
provide a unified, Arkiv-backed developer workflow across browser, CLI,
SDK, and API.

## 3. Product goals

### 3.1 MVP goals

-   Mirror function signatures from the MIT-licensed ethereum-lists/4bytes repository into Arkiv.
-   Mirror event signatures from a verified upstream endpoint where
    available.
-   Preserve source IDs, source attribution, dataset/import version,
    timestamps, and deterministic record hashes.
-   Query canonical mirrored records from Arkiv.
-   Resolve selectors and topics without assuming uniqueness.
-   Decode calldata and event logs using `viem`.
-   Expose shared behavior through API, SDK, CLI, and Studio.
-   Provide an evidence-backed transaction investigation workflow when a
    supported RPC endpoint is configured.
-   Make Arkiv integration inspectable and reproducible for judges and
    developers.
-   Deliver polished, responsive, minimalist interfaces.

### 3.2 Success measures

The MVP is successful when: - A clean setup can connect to Arkiv
Rabdi. - A real source record is imported and written to Arkiv. - The
record is read back from Arkiv and verified. - The resolver returns
every matching candidate for a selector. - A valid calldata sample is
decoded using a candidate signature. - The API, SDK, CLI, and Studio use
the same domain logic. - The CLI works in human-readable and JSON
modes. - The application distinguishes unknown, ambiguous, failed, and
successful decodes. - Tests cover critical validation, collision,
failure, and provenance paths. - A new developer can follow the README
without relying on undocumented chat context.

### 3.3 Non-goals

-   Building an EVM node or RPC provider.
-   Reconstructing a complete contract ABI from four-byte selector data.
-   Claiming a signature match proves contract identity, intent, or
    safety.
-   Producing an unsupported risk score or AI security verdict.
-   Supporting every EVM chain, provider, or historical indexing use
    case.
-   Building a full block explorer.
-   Treating unverified community submissions as canonical.
-   Depending on PostgreSQL for the canonical signature registry in the
    MVP.
-   Building a large microservice fleet.

## 4. Users and jobs to be done

### Persona A --- Smart-contract developer

Needs to inspect selectors, decode calldata, understand logs, and
investigate transactions while debugging contracts and integrations.

### Persona B --- Wallet/dApp developer

Needs a dependable API or SDK to interpret EVM interactions inside
wallet interfaces, explorers, dashboards, and developer tools.

### Persona C --- Developer-tool builder

Needs CLI and API access, predictable JSON output, provenance, stable
error semantics, and automation support.

### Primary jobs

-   "When I see an unknown selector, help me discover all known
    candidate signatures."
-   "When I paste calldata, show the candidate function and decoded
    arguments."
-   "When I inspect a log, resolve its event topic and decode indexed
    and non-indexed values."
-   "When I provide a transaction hash, combine actual RPC transaction
    facts with Arkiv-backed signature knowledge."
-   "When I integrate ATLAS into a script or application, give me stable
    API and SDK contracts."

## 5. Product principles

1.  **Evidence before interpretation:** every signature result exposes
    source and provenance.
2.  **Ambiguity is a first-class result:** never silently select one
    candidate when multiple candidates exist.
3.  **Arkiv is real infrastructure:** canonical mirrored records are
    read from Arkiv, not a hardcoded JSON substitute.
4.  **Separate facts from interpretations:** transaction status comes
    from the chain receipt; signature meaning comes from the registry.
5.  **Developer-first ergonomics:** consistent interfaces, useful
    errors, copyable examples, automation-friendly output.
6.  **Minimalist visual design:** high information density without
    visual clutter.
7.  **Progressive disclosure:** show the useful answer first; reveal
    provenance, raw data, and diagnostics on demand.
8.  **Honest limitations:** unknown and unsupported states are explicit,
    not disguised as success.

## 6. Scope and release priorities

### P0 --- Required MVP

-   Monorepo foundation and shared TypeScript configuration.
-   Arkiv Rabdi connection and verified write/read.
-   Function-signature importer.
-   Function lookup by selector.
-   Collision-aware resolution.
-   Calldata decoding with `viem`.
-   Minimal REST API.
-   TypeScript SDK wrapping the API or shared services.
-   CLI: lookup, search, decode, doctor, JSON output.
-   Studio: Signature Explorer and Calldata Decoder.
-   Provenance display.
-   Automated tests, setup documentation, Arkiv documentation, and
    import report.

### P1 --- Strong MVP extension

-   Event signature importer.
-   Event lookup and log decoding.
-   RPC-backed transaction investigation.
-   JSON report export.
-   API playground and developer documentation.

### P2 --- Optional / post-MVP

-   Community observations with wallet authorization.
-   Contract-wide inspection using an indexed provider.
-   Custom error signature data from a separately verified source.
-   Additional EVM networks and RPC providers.
-   Advanced caching and analytics.

P0 must be complete before P1 is allowed to threaten delivery. P2 must
not delay the core Arkiv vertical slice.

## 7. Functional requirements

### FR-01: Source importer

-   Fetch function-signature records from a pinned ethereum-lists/4bytes Git commit (or a reproducible GitHub API/raw-file snapshot); preserve the commit SHA and source file path.
-   Support event-signature records only after verifying the endpoint
    and its semantics.
-   Preserve upstream IDs and original source attribution.
-   Normalize identifiers and signature strings deterministically.
-   Validate record shape and selector/topic consistency.
-   Compute deterministic content hashes.
-   Support dry-run, resumable import, and verification.
-   Produce an import manifest/report with counts and failures.
-   Be idempotent for an unchanged source snapshot.
-   Never collapse selector collisions.

### FR-02: Arkiv mirror

-   Use official Arkiv SDK and documented Rabdi configuration.
-   Define named schemas for function signatures, event signatures,
    observations, and import manifests as needed.
-   Write using an ATLAS-controlled importer identity.
-   Query canonical records with schema and owner/creator verification.
-   Paginate all query results.
-   Validate returned data before use.
-   Deduplicate by deterministic record hash.
-   Apply and document expiration policy supported by the actual
    SDK/network.
-   Surface Arkiv connectivity and operational errors honestly.

### FR-03: Function resolver

-   Accept normalized four-byte selectors.
-   Query Arkiv canonical function records.
-   Return zero, one, or multiple candidates.
-   Preserve source ID, source, import timestamp, dataset version,
    record hash, and entity key.
-   Expose ambiguity explicitly.
-   Do not assert that a candidate is the actual implementation's
    behavior.

### FR-04: Event resolver

-   Accept normalized 32-byte topic0.
-   Query Arkiv canonical event records.
-   Return all candidates and provenance.
-   Be implemented only when source endpoint coverage is verified.

### FR-05: Calldata decoder

-   Validate hexadecimal calldata.
-   Extract the first four bytes as selector.
-   Resolve all candidates.
-   Attempt decoding for each candidate with `viem`.
-   Return per-candidate success/failure.
-   Never invent parameter names. Use `arg0`, `arg1`, etc. unless a real
    ABI provides names.
-   Preserve raw values safely, including bigint values serialized as
    strings.
-   Distinguish no candidate from candidate-but-decode-failed.
-   Include ambiguity and warnings.

### FR-06: Event log decoder

-   Validate topics and data.
-   Resolve topic0.
-   Decode indexed and non-indexed parameters with `viem`.
-   Return candidate-level outcomes and warnings.
-   Do not assume all logs contain a known topic.

### FR-07: Transaction investigation

-   Require transaction hash and chain ID.
-   Fetch transaction and receipt through a configured RPC client.
-   Report chain facts from RPC only.
-   Resolve the input selector through Arkiv.
-   Decode receipt logs through the event registry where supported.
-   Include evidence source labels and limitations.
-   Do not call the result a security audit or safety verdict.
-   Handle unavailable RPC, missing transaction, pending transaction,
    reverted transaction, and unsupported chain.

### FR-08: REST API

Required MVP endpoints: - `GET /health` -
`GET /v1/functions/:selector` -
`GET /v1/functions/search?q=&limit=&cursor=` -
`POST /v1/decode/calldata` - `GET /v1/events/:topic0` when event support
is shipped - `POST /v1/decode/logs` when event support is shipped -
`POST /v1/transactions/analyze` when RPC investigation is shipped

API rules: - Validate all inputs at the boundary. - Use stable error
codes. - Return consistent JSON. - Add request IDs. - Bound request
sizes and pagination. - Apply rate limits. - Do not leak secrets or
stack traces. - Use explicit API versioning.

### FR-09: TypeScript SDK

-   Provide a documented `Atlas` client.
-   Expose lookup, search, calldata decode, event decode, and
    transaction investigation as capabilities are shipped.
-   Use stable typed request and response contracts.
-   Use the hosted API by default.
-   Support configurable base URL, timeout, and API key if
    authentication is enabled.
-   Never require private keys for read-only functionality.
-   Do not duplicate domain logic.

### FR-10: CLI

Required commands: - `atlas lookup <selector>` -
`atlas search <query>` - `atlas decode <calldata>` - `atlas doctor`
Optional commands as corresponding capabilities ship: -
`atlas event <topic0>` - `atlas decode-log` -
`atlas tx <hash> --chain <chainId>` -
`atlas inspect <address> --chain <chainId>` - `atlas config set ...`

Global flags: - `--json` - `--quiet` - `--verbose` - `--timeout <ms>` -
`--api-url <url>`

CLI requirements: - stdout contains results; stderr contains
diagnostics. - JSON mode emits valid machine-readable JSON only. - Exit
codes are stable and documented. - Invalid input is rejected before
network calls when possible. - Errors include actionable next steps. -
Support shell piping and report export. - Never print secrets.

Suggested exit codes: - `0`: successful request. - `1`: operational
failure. - `2`: invalid usage/input. - `3`: no matching signature. -
`4`: ambiguous or incomplete result in strict mode. Ambiguity in normal
mode may return 0 with `ambiguous: true`.

### FR-11: Studio

Required routes: - `/` --- product landing / workspace entry. -
`/explorer` --- signature explorer. - `/decode` --- calldata decoder. -
`/events` --- event inspector when supported. - `/transactions` ---
transaction lab when supported. - `/docs` --- developer documentation or
links. - `/status` --- service connectivity/status.

Studio requirements: - Responsive desktop and mobile layout. -
Minimalist, premium developer-tool aesthetic. - Clear typography and
hierarchy. - Dark-first or carefully implemented theme; do not mix
arbitrary palettes. - Fast, purposeful transitions; respect
reduced-motion preferences. - Accessible keyboard navigation, focus
states, and contrast. - Loading, empty, error, ambiguous, and success
states for every workflow. - Copy buttons for selectors, signatures,
decoded JSON, and entity keys. - Provenance visible without overwhelming
the primary result. - No fake metrics or fake connection badges. - No
mock data in production UI.

### FR-12: Community observations (optional)

-   Require cryptographic wallet authorization or another explicit
    authenticated identity.
-   Do not trust a client-provided owner field.
-   Store observations separately from canonical records.
-   Default status is `unverified`.
-   Store evidence and timestamps.
-   Display submitting owner and verification state.
-   Add spam/rate controls.
-   Never promote an observation to canonical automatically.

## 8. Data model and Arkiv schema requirements

The exact SDK schema syntax must be verified against the installed Arkiv
SDK and current official documentation. The following is the logical
schema contract, not permission to invent SDK methods.

### FunctionSignature

-   `selector`: normalized 4-byte hex selector; indexed.
-   `signature`: canonical signature text.
-   `source`: upstream source; indexed.
-   `sourceId`: upstream record ID; indexed.
-   `sourceUpdatedAt`: optional upstream timestamp.
-   `importedAt`: ISO timestamp; indexed.
-   `datasetVersion`: import snapshot identifier; indexed.
-   `recordHash`: deterministic hash; indexed.

### EventSignature

-   `topic0`: normalized 32-byte hash; indexed.
-   `signature`: canonical event signature.
-   `source`: source name; indexed.
-   `sourceId`: upstream ID; indexed.
-   `importedAt`: ISO timestamp; indexed.
-   `datasetVersion`: import snapshot identifier; indexed.
-   `recordHash`: deterministic hash; indexed.

### Observation

-   `kind`: function or event; indexed.
-   `identifier`: selector or topic0; indexed.
-   `signature`: proposed signature.
-   `chainId`: chain identifier or `global`; indexed.
-   `contractAddress`: normalized address or `global`; indexed.
-   `evidenceUrl`: optional evidence.
-   `status`: unverified/supported/rejected; indexed.
-   `submittedAt`: ISO timestamp; indexed.
-   `observationHash`: deterministic identifier; indexed.

### ImportManifest

-   Source, endpoint, importer version/commit, dataset version,
    timestamps, counts, failure summary, license URL, and importer
    identity.

### Trust and ownership

-   Canonical mirrored records must be queried with the ATLAS importer
    owner/creator filter, using the actual metadata field exposed by
    Arkiv.
-   Never trust a user-controlled `source`, `datasetVersion`, or `owner`
    property as proof of origin.
-   Community observations must remain separate and visibly unverified.
-   Selector uniqueness must not be enforced.
-   Pagination must be complete.
-   Expired entities must not be shown as current.

### Expiration

Proposed policy, subject to actual network/API support: - Signature
mirrors: renewable 365-day lifetime. - Community observations: 90-day
lifetime. - Import manifests: 365-day lifetime. If the network does not
support a requested expiry behavior, document the verified limitation
and implement a safe alternative.

## 9. API contracts

### Function lookup

`GET /v1/functions/{selector}`

Response shape:

``` json
{
  "identifier": "0xa9059cbb",
  "kind": "function",
  "ambiguous": false,
  "candidates": [
    {
      "signature": "transfer(address,uint256)",
      "source": "ethereum-lists/4bytes",
      "sourceId": "12345",
      "entityKey": "arkiv-entity-key",
      "provenance": {
        "datasetVersion": "snapshot-id",
        "importedAt": "2026-11-05T10:00:00Z"
      }
    }
  ],
  "registry": "arkiv-rabdi"
}
```

### Function search

`GET /v1/functions/search?q=transfer&limit=20&cursor=...`

``` json
{
  "items": [],
  "pagination": {
    "nextCursor": null
  }
}
```

### Calldata decode

`POST /v1/decode/calldata`

Request:

``` json
{
  "calldata": "0xa9059cbb...",
  "strict": false
}
```

Response:

``` json
{
  "selector": "0xa9059cbb",
  "ambiguous": false,
  "decoded": [
    {
      "signature": "transfer(address,uint256)",
      "arguments": [
        {"name": "arg0", "type": "address", "value": "0x..."},
        {"name": "arg1", "type": "uint256", "value": "1000"}
      ],
      "decodeStatus": "success"
    }
  ],
  "warnings": []
}
```

Bigints must be serialized as decimal strings. Do not assume the
illustrative selector or example source ID is a real fetched result.

### Event lookup

`GET /v1/events/{topic0}`

Returns all candidates and provenance.

### Log decode

`POST /v1/decode/logs`

Request:

``` json
{
  "topics": ["0xddf252ad...", "0x..."],
  "data": "0x..."
}
```

### Transaction analysis

`POST /v1/transactions/analyze`

Request:

``` json
{
  "hash": "0x...",
  "chainId": 1
}
```

Response must separate: - transaction and receipt facts from RPC; -
signature interpretations from Arkiv; - decoding results from `viem`; -
limitations and warnings.

### Error envelope

``` json
{
  "error": {
    "code": "INVALID_SELECTOR",
    "message": "Expected a 4-byte hexadecimal selector.",
    "details": null,
    "requestId": "req_123"
  }
}
```

Suggested HTTP statuses: - 200 successful lookup/decode, including a
valid empty lookup. - 400 malformed input. - 401 missing/invalid
authorization. - 404 only for genuinely absent resources where
appropriate. - 422 valid request but no candidate could be decoded, if
the endpoint contract chooses this distinction. - 429 rate limited. -
502 upstream dependency failure. - 503 service unavailable.

Unknown selector lookup should normally return 200 with an empty
candidates array, not 404.

## 10. Domain result semantics

### LookupResult

-   identifier
-   kind
-   candidates\[\]
-   ambiguous
-   registry/source metadata
-   warnings

### CalldataDecodeResult

-   selector
-   candidates attempted
-   per-candidate decode status
-   decoded arguments when successful
-   ambiguous
-   warnings
-   provenance

### TransactionInvestigation

-   transaction facts
-   receipt status
-   function candidates and decode attempts
-   event candidates and decode attempts
-   source labels
-   limitations

Never collapse these into a single "safe/unsafe" label.

## 11. Technology and architecture

Preferred baseline: - TypeScript with strict mode. - pnpm workspaces. -
Next.js App Router for Studio. - Tailwind CSS and a consistent component
system. - Fastify for REST API. - Commander for CLI. - viem for EVM
types, RPC clients, and ABI decoding. - Zod for validation. - Official
Arkiv TypeScript SDK. - Vitest for unit/integration tests where
suitable. - Playwright for browser end-to-end tests. - ESLint and
Prettier. - Vercel for Studio; a suitable Node runtime for API/importer.

Monorepo:

``` text
atlas/
  apps/
    studio/
  packages/
    schemas/
    core/
    arkiv/
    chain/
    sdk/
    cli/
  services/
    api/
  importer/
    src/
      sources/
      normalize/
      validate/
      write/
      checkpoints/
  arkiv/
    schema.md
    friction.md
    reach.md
    why-arkiv.md
    data-quality.md
  docs/
  tests/
  README.md
  BACKLOG.md
  plan.md
  AI_USAGE.md
  pnpm-workspace.yaml
  package.json
```

Architecture boundaries: - `schemas`: shared types and runtime
validation. - `core`: domain use cases; no Arkiv, Next.js, Fastify, or
CLI framework imports. - `arkiv`: Arkiv SDK integration, repository
implementations, ownership verification, pagination. - `chain`: RPC
clients and transaction/log retrieval. - `sdk`: public typed client,
initially API-backed. - `cli`: command parsing and output formatting,
calling SDK/API. - `api`: HTTP boundary, validation, auth/rate limiting,
calling core. - `importer`: source ingestion and Arkiv writes. -
`studio`: UI only; no private key and no duplicate business logic.

## 12. UX and visual design specification

ATLAS must look like a high-quality professional developer tool. "Sexy"
means deliberate, fast, clear, restrained, and polished---not excessive
gradients, glowing cards, noisy backgrounds, or animation for its own
sake.

### Visual principles

-   Minimalist, editorial developer-tool aesthetic.
-   Strong typography hierarchy.
-   Consistent spacing and alignment.
-   Restrained color palette: deep charcoal/navy surfaces, neutral text,
    one primary accent, and semantic success/warning/error colors.
-   Use monospaced type only for code, hashes, selectors, and technical
    metadata.
-   Use subtle borders and surface contrast rather than many shadows.
-   Avoid clutter, unnecessary cards, oversized hero copy inside working
    tools, and decorative charts with no data.
-   Make the main task obvious within the first viewport.

### Interaction principles

-   Every interactive element must work.
-   Provide clear loading, empty, error, success, ambiguous, and
    unavailable states.
-   Use skeletons only when they improve perceived loading.
-   Copy actions must give feedback.
-   Keep transitions short and purposeful.
-   Respect `prefers-reduced-motion`.
-   Support keyboard navigation and visible focus.
-   Avoid layout shift.
-   Mobile layouts must remain usable, not merely shrink desktop.

### CLI visual design

-   Human-readable output with restrained color.
-   Clear labels and aligned values.
-   No ASCII art that delays the result.
-   JSON mode must contain no decoration or progress text on stdout.
-   Progress indicators go to stderr.
-   Color must be disabled automatically or by flag when output is not a
    TTY.

## 13. Security, reliability, and privacy

-   Keep signing keys out of frontend bundles and source control.
-   Use environment variables or a secure secret store.
-   Provide `.env.example` with names and descriptions, never secrets.
-   Separate read-only public access from write authorization.
-   Authenticate observation submissions.
-   Rate-limit public endpoints.
-   Validate and bound input lengths.
-   Protect against SSRF if accepting evidence URLs; ideally
    validate/store URLs without fetching them in MVP.
-   Do not execute submitted code.
-   Do not log secrets or full authorization headers.
-   Handle upstream timeouts and retry only idempotent operations.
-   Use bounded retries with backoff.
-   Avoid unbounded RPC history scans.
-   Do not expose raw internal stack traces in API responses.
-   Document data sources and retention/expiration.

## 14. Testing and quality gates

### Unit tests

-   Selector/topic normalization.
-   Signature parsing and hashing.
-   Duplicate detection.
-   Collision handling.
-   Candidate resolution.
-   ABI decoding.
-   Bigint JSON serialization.
-   Error mapping.
-   CLI argument validation.

### Integration tests

-   Arkiv schema registration/usage as required by SDK.
-   Write and read back an entity.
-   Owner-filtered lookup.
-   Pagination across more than one page.
-   Importer dry run and idempotency.
-   API integration against test doubles and, where practical, Rabdi.

### End-to-end tests

-   Studio lookup.
-   Studio calldata decode.
-   Error and empty states.
-   CLI lookup in human and JSON mode.
-   SDK usage against a running API.
-   Transaction investigation when RPC is configured.

### Quality gates

A phase is not complete unless: - TypeScript checks pass. - Relevant
tests pass. - Lint/format checks pass. - Build passes for affected
packages. - No secrets are committed. - Documentation reflects actual
behavior. - No required real integration is replaced by a mock.

## 15. Observability and operational requirements

-   Structured server logs.
-   Request IDs across API operations.
-   Import run IDs.
-   Import counts and failure reasons.
-   Arkiv/RPC health checks with explicit status.
-   Request latency and upstream latency.
-   No fabricated uptime or dataset counters.
-   A `doctor` command that reports configuration and connectivity
    without revealing secret values.

## 16. Deployment and environment

### 16.1 Development mode: local-only

- All implementation, integration, tests, and demo preparation happen locally first.
- Do not create a hosted repository, commit, push, publish a package, or deploy until the user explicitly approves the specific action.
- Keep `.env.example` in source control only after repository creation is approved; real `.env` files and credentials remain local and untracked.
- Local development must support a reproducible startup path (documented commands, dependency versions, local service requirements, and seed/import steps).

### 16.2 Final target: fully online

The final accepted delivery is an online product, not a local-only demo. The following must be publicly reachable where relevant:

- **Studio:** hosted Next.js application (Vercel free tier is a candidate).
- **REST API:** hosted Node/Fastify service on a free tier that supports the runtime, persistent process requirements, and expected request volume.
- **Arkiv integration:** deployed API must query/write to the intended Arkiv network using server-side credentials/configuration as required.
- **Documentation:** public docs or a clear online API reference.
- **CLI/SDK:** published installable artifacts only if useful and supported by free distribution; otherwise provide source/install instructions and a working online API endpoint.
- **Importer:** source code and exact rerun instructions in the approved public repository; any production import/write is separately approval-gated.
- **Health/readiness:** public health endpoint and a deployment smoke-test procedure.

### 16.3 Provider selection and cost policy

- Prefer free-tier services such as Vercel for the Studio and a suitable free Node hosting provider for the API. Provider selection must be based on current verified limits, not assumptions.
- Check sleeping/cold-start behavior, execution duration, bandwidth, build minutes, storage, database limits, custom-domain restrictions, and Arkiv/RPC connectivity.
- No paid plan, paid add-on, usage-based billable resource, or unexpected upgrade without explicit user approval.
- Free tiers can change or impose limits. The project must document the selected providers, limits, known availability/cold-start tradeoffs, and a fallback plan.
- If a free host cannot support a required component, stop and present alternatives; do not quietly downgrade functionality or incur costs.

### 16.4 Deployment approval protocol

Deployment is a late project phase and is never automatic. Before each individual deployment, present:
1. Provider and exact target project/service.
2. What code/configuration will be uploaded.
3. Public/private exposure and expected URL.
4. Required environment variables and where secrets will be stored.
5. Network and data target (including Arkiv network).
6. Free-tier limits and any possible charges.
7. Rollback/removal steps.

Then ask for explicit approval. A single approval only covers the named deployment action(s). Repeat this process for each separate target unless the user explicitly approves a clearly enumerated batch.

### 16.5 Secrets and environment

- Keep private keys, API tokens, RPC credentials, and provider secrets out of source code and logs.
- Use local `.env` files for development and the selected host's secret manager for approved deployment.
- Provide `.env.example` with names and descriptions only.
- Never ask a coding agent to print secrets. Redact secrets in diagnostics.

## 17. Official references and verification policy

Start with these sources and confirm current versions before coding: -
Arkiv documentation: https://docs.arkiv.network/ - Arkiv first entity:
https://docs.arkiv.network/start-here/first-entity/ - Arkiv schemas:
https://docs.arkiv.network/schemas/define/ - Arkiv filtering:
https://docs.arkiv.network/querying/filter/ - Arkiv pagination:
https://docs.arkiv.network/querying/paginate/ - Arkiv Rabdi:
https://docs.arkiv.network/networks/rabdi/ - ethereum-lists/4bytes API docs:
https://www.ethereum-lists/4bytes/docs/ - viem documentation:
https://viem.sh/ - Next.js documentation: https://nextjs.org/docs -
Fastify documentation: https://fastify.dev/docs/latest/ - Commander
documentation: https://github.com/tj/commander - Zod documentation:
https://zod.dev/

SDK details, network names, schema field types, owner metadata, expiry
behavior, query pagination, and write methods must be verified against
the installed Arkiv SDK version and current official docs. This PRD
defines product behavior; it is not a substitute for SDK documentation.


## 17A. ETHGlobal Mirror-track qualification gates

These are mandatory submission requirements, not optional product enhancements.

### QG-01 — Built from scratch
- ATLAS application code and integration work must be created during ETHGlobal Mumbai in accordance with ETHGlobal rules.
- Do not copy another team's submission or represent pre-existing work as newly built.
- Keep a meaningful Git history and disclose relevant AI assistance in `AI_USAGE.md`.

### QG-02 — Republishable data license
- The initial source is the `ethereum-lists/4bytes` repository: https://github.com/ethereum-lists/4bytes
- Its repository metadata identifies the project as MIT-licensed. Include the source repository link and MIT license link in README.
- Preserve source attribution in imported records and import manifests.
- Before using any additional source, inspect its actual license and verify that it permits copying, modification, and republication of the dataset.
- Public API accessibility alone is not a redistribution license.

### QG-03 — Sourcify exclusion
- No Sourcify data from any chain may be used.
- Do not query Sourcify APIs, import Sourcify datasets, use Sourcify-verified contract signatures, or consume merged signature databases containing Sourcify-derived records.
- If a source has mixed provenance and cannot reliably separate Sourcify-derived records, do not use it.
- Record the source and commit/snapshot used for every import so the provenance can be audited.

### QG-04 — Re-runnable importer
- Importer source code must be committed in the repository.
- README must contain exact setup, configuration, dry-run, import, and verification commands.
- Judges must be able to rerun the importer using their own valid Arkiv credentials.
- The importer must be deterministic for a pinned source commit and idempotent against existing Arkiv entities.
- Include a sample report generated by a real import, clearly identifying its source commit and timestamp.

### QG-05 — Qualification evidence
- README links the source license.
- `data-quality.md` documents source provenance, pinning, validation, and exclusion of Sourcify.
- Import script is present and runnable.
- No unsupported claim of dataset completeness or adoption is made.

## 18. Acceptance checklist

### Arkiv mirror

-   [ ] Real source data fetched.
-   [ ] Source IDs and attribution preserved.
-   [ ] Data validated and normalized.
-   [ ] Deterministic hashes generated.
-   [ ] Records written to Arkiv by ATLAS identity.
-   [ ] Records queried back from Arkiv.
-   [ ] Owner/creator verified.
-   [ ] Pagination handled.
-   [ ] Import manifest and verification report generated.

### Core

-   [ ] Function lookup returns all candidates.
-   [ ] Collisions are explicit.
-   [ ] Calldata decode uses viem.
-   [ ] Decode failures are represented per candidate.
-   [ ] Provenance is retained.
-   [ ] No false safety/identity claims.

### Interfaces

-   [ ] API endpoints and errors documented.
-   [ ] SDK works against API.
-   [ ] CLI supports human and JSON modes.
-   [ ] CLI exit codes documented and tested.
-   [ ] Studio lookup and decode workflows work.
-   [ ] UI states and accessibility are implemented.

### Delivery
- [ ] Final Studio, API, and required supporting surfaces are online and smoke-tested on approved free-tier services (or approved alternatives).
- [ ] Hosted repository creation, each push, and each deployment were separately approved by the user.
- [ ] No deployment or publication occurred before explicit approval; no paid resource was enabled without approval.
- [ ] Lovable-first UI was reviewed and integrated locally before production frontend completion.

-   [ ] README has setup and run instructions.
-   [ ] `.env.example` is accurate.
-   [ ] Tests and builds pass.
-   [ ] Arkiv judging documentation is complete.
-   [ ] Demo script uses real Arkiv data.
-   [ ] Limitations are disclosed.

## 19. Final product definition

ATLAS is done when a developer can take an EVM selector or calldata
payload, resolve candidate signatures from a real Arkiv-backed mirror,
inspect provenance and ambiguity, decode the payload, and perform the
same workflow through Studio, CLI, SDK, and API---with tests and
documentation proving that the system works.


## 20. Mirror-track judging response map

The repository must answer the exact sponsor questions, not merely describe features.

| Criterion | Judge's question | Required evidence |
|---|---|---|
| Arkiv feedback (25%) | What got in the way? What broke, what was expected, and how can it be reproduced? | `/arkiv/friction.md` with SDK version, operation, expected/actual result, minimal reproduction, workaround, suggested improvement. Never invent friction. |
| Reach (25%) | How many people/projects already depend on the data? Who will use the Arkiv copy after Mumbai and why? | `/arkiv/reach.md` with measured source counts, unique selectors, downstream examples, actual consumers if measured, and realistic target users. Do not invent adoption. |
| Why Arkiv (25%) | What would people lose with Postgres? What can they do with the Arkiv copy that they cannot do with the original source? | `/arkiv/why-arkiv.md` with concrete independent-query, composability, ownership/provenance, and lifecycle examples; disclose source features not yet matched. |
| Data quality (25%) | Is the data current? How is it kept current? Can people filter it as they search? | `/arkiv/data-quality.md` with pinned source commit, import process, rerun cadence, validation, collisions, read-back verification, freshness, and supported filters. |

All four criteria are weighted equally. The four documents are mandatory judging artifacts.
