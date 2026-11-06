# ATLAS implementation status

**Date:** 2026-11-06 (local)
**Scope:** every source file, the root quality commands, the importer, the Arkiv
adapter, the core/chain/API/SDK/CLI stack and the Studio.
**Method:** read source/tests, verified `@arkiv-network/sdk` 1.0.1 typings,
ran the full quality gates, inspected the actual import report/checkpoint, and
verified the Rabdi transaction receipt and live API record. See
[docs/arkiv-live-proof.md](arkiv-live-proof.md).
**Version control:** the workspace is **not** a Git repository. No repository,
commit, remote, push, publication or deployment was created.

---

## 1. Verified baseline

| Command                          | Result   | Evidence                                                     |
| -------------------------------- | -------- | ------------------------------------------------------------ |
| `pnpm install --frozen-lockfile` | **pass** | 10 workspace projects; lockfile up to date                   |
| `pnpm lint`                      | **pass** | ESLint, 0 problems                                           |
| `pnpm format:check`              | **pass** | Prettier, all files match                                    |
| `pnpm typecheck`                 | **pass** | schemas, arkiv, importer, core, chain, API, SDK, CLI, Studio |
| `pnpm test`                      | **pass** | 255 passed; 5 live-network tests skipped                     |
| `pnpm build`                     | **pass** | all packages and Studio build; 560.83 kB chunk warning       |

Test distribution: schemas 19, arkiv 24 (2 skipped), importer 54, core 22,
chain 10 (2 skipped), API 73 (1 skipped), SDK 9, CLI 10, Studio 34. Total:
255 passed and 5 skipped.

Non-blocking: the Studio production build emits a 560.83 kB minified main-chunk
warning. Production preview returned the Studio shell with HTTP 200 on all
seven routes, including direct refresh paths.

---

## 2. What is implemented

### Contracts — `packages/schemas` (19 tests)

Branded primitives, normalization, function/event/observation/manifest records,
lookup/search/decode/transaction/health result schemas, request schemas, error
codes and API envelope, canonical hashing. Internal package, not published.

### Arkiv adapter — `packages/arkiv` (24 tests)

Env validation without leaking values, Rabdi client construction, trusted-creator
filtering, flat row decoding, keyset pagination (100/page), record-hash
dedupe/conflict detection, idempotent lookup, write path (creator check,
`ExpirationTime.fromDays(180)`), read-only health probe, honest
`searchBySignature` full scan with an offset cursor. Function and event
read adapters share the same creator/pagination/conflict rules; `indexed`
layouts are stored as `1,0,1` and rejected if malformed.

**Live-verified for one record only.** A single OpenZeppelin function record
was written, read back, and queried through the live API. The test gate remains
read-only and is distinct from that completed write; no additional records
were imported.

### Importer (54 tests)

Pinned sources (`openzeppelin-contracts` MIT, `ethereum-ercs` CC0-1.0) with
commit SHA, licence-file hash and tree digest; shallow fetch; licence assertion;
per-file symbol resolution (contracts, enums, UDVTs, structs); line-level
`sourceId`; `viem` re-validation (mismatch = rejection); deterministic
checkpoints (v1, batch ≤100, identity-bound, atomic); batched idempotent writes;
read-back `verify`; `snapshot`/`dry-run`/`import`/`verify`/`doctor` commands;
`ATLAS_WRITE_APPROVAL` gate.

Real dry runs:

| Dataset                                          | Files | Declarations | Validated | Functions | Events | Rejected | Collisions |
| ------------------------------------------------ | ----: | -----------: | --------: | --------: | -----: | -------: | ---------: |
| `openzeppelin-contracts@efaa6f78ab1d-2026-11-02` |   376 |        1,239 |       703 |       544 |    159 |        0 |          0 |
| `ethereum-ercs@7dafd1125ffb-2026-11-04`          |   734 |        5,594 |     3,189 |     2,611 |    578 |       36 |          0 |

See `docs/reports/dataset-assessment.md` and the JSON reports beside it.

### Core — `packages/core` (22 tests)

Selector parsing, candidate mapping, lookup with ambiguity/warnings and empty
results, search limits/pagination, calldata decoding with round-trip validation,
bigint → decimal strings, event lookup and log decoding. Indexed layouts are
honoured when pinned; otherwise exactly one matching layout wins and multiple
layouts fail with "ATLAS will not guess".

### Chain — `packages/chain` (10 tests)

Only chain IDs `1` and `11155111`; env URLs `ATLAS_RPC_URL_1` and
`ATLAS_RPC_URL_11155111`; no invented default RPC. `ChainReader` maps
missing/pending to `NOT_FOUND`, RPC failures to `UPSTREAM_UNAVAILABLE`, and
receipts to success/reverted/null.

### API — `services/api` (73 passed, 1 skipped)

Fastify 5 service with `/health`, `/v1/functions/search`,
`/v1/functions/:selector`, `/v1/decode/calldata`, `/v1/events/:topic0`,
`/v1/decode/logs`, `/v1/transactions/analyze`. Request-ID echo, rate limiting,
shared error envelope, upstream timeouts. Transaction analysis separates verified
RPC facts, Arkiv candidates and decoded logs, and lists limitations (internal
calls not decoded; first 25 logs only).

Live RPC smoke test: a mined Mainnet transaction analyzed with a public RPC
returned verified `source:"rpc"` transaction/receipt facts; registry-dependent
fields stayed null with explicit warnings. `/health` returned
`200 {status:"degraded"}` without credentials; an unconfigured registry
returned `502 UPSTREAM_UNAVAILABLE`; an invalid selector returned
`INVALID_SELECTOR`. Separately, the live Arkiv API returned the verified
`getRoleMember(bytes32,uint256)` record at `0x9010d07c`; its entity key and
record hash match the import report and read-back evidence.

### SDK — `packages/sdk` (9 tests)

Typed client over the API with zod response validation, timeout, and
`AtlasSdkError` (`NETWORK_ERROR`, `INVALID_RESPONSE` plus domain codes).
Documented in `packages/sdk/README.md`. Not published.

### CLI — `packages/cli` (10 tests)

`lookup`, `search`, `decode`, `event`, `logs`, `tx`, `doctor`; `--json`,
`--api-url`, `--timeout`, `ATLAS_API_URL`; documented exit codes 0/1/2/3/4.
Documented in `packages/cli/README.md`. Not published.

### Studio — `apps/studio` (34 tests)

Seven routes preserved with the iOS-inspired design. Explorer and Decoder use the
API client; Event Inspector and Transaction Lab now call `/v1/decode/logs` and
`/v1/transactions/analyze` and render honest unconfigured/error/empty states.
Transaction networks are limited to the two supported chains. Sample mode stays
off by default and is labelled. The status route distinguishes endpoint
implementation from live connectivity; the homepage states that only one
function record is currently verified.

**Residual:** fixtures remain bundled but are clearly opt-in and separate from
live API results; there is no automated browser-level test suite and no
deployment.

### Cross-interface consistency

`scripts/consistency.mjs` compares REST, SDK and CLI output for the same
selector. It passed all three checks against `scripts/fixture-api.mjs` (an
explicit in-memory repository, health `version: "fixture"`). That is still
fixture-based consistency evidence, not a full live consistency run. The one
live Arkiv API record is documented in
[docs/arkiv-live-proof.md](arkiv-live-proof.md). Evidence for the earlier
fixture run: `.audit/consistency.log`.

---

## 3. Configuration

| Variable                                    | Consumer                 | Required                                                | Status |
| ------------------------------------------- | ------------------------ | ------------------------------------------------------- | ------ |
| Variable                                    | Consumer                 | Production guidance                                     |
| ---                                         | ---                      | ---                                                     |
| `ARKIV_ACCESS_KEY`                          | API Arkiv reads          | Required server-side; never expose through `VITE_`      |
| `ATLAS_ARKIV_CREATOR_ADDRESS`               | API canonical filtering  | Required server-side; match the imported entity creator |
| `ARKIV_PRIVATE_KEY`                         | Importer writes only     | Never configure on Vercel                               |
| `ATLAS_WRITE_APPROVAL`                      | Importer writes only     | Never configure on the read-only API                    |
| `ATLAS_CORS_ORIGINS`                        | API CORS                 | Exact production Studio origin                          |
| `ATLAS_CORS_DEV_ORIGINS`                    | API CORS                 | Set to `false` in production                            |
| `VITE_ATLAS_API_URL`                        | Studio                   | Public production API origin                            |
| `ATLAS_RPC_URL_1`, `ATLAS_RPC_URL_11155111` | API transaction analysis | Optional server-side RPC endpoints                      |
| `ATLAS_RATE_LIMIT_PER_MINUTE`               | API                      | Optional; default 120 per function instance             |
| `ATLAS_UPSTREAM_TIMEOUT_MS`                 | API                      | Optional; default 8000 ms                               |

`.env.example` documents variable names only. The local `.env` is in a
OneDrive-synchronized workspace; `.gitignore` does not prevent cloud sync.
Move credentials to a local secret store outside the synced directory.

---

## 4. Gates and open items

| Item                                    | State                                                                       |
| --------------------------------------- | --------------------------------------------------------------------------- |
| Live Arkiv read/consistency proof       | **One function record verified; full live consistency run remains open**    |
| Live Arkiv write / read-back            | **One function record completed; no further import approved**               |
| Event-signature Arkiv schema + writes   | Not implemented (PRD phase 10)                                              |
| Event registry in API                   | Stays empty; on-chain facts degrade with warnings                           |
| npm publication of SDK/CLI              | **Not allowed** without separate explicit approval                          |
| Git repository / commits / deploy       | Not created; Vercel configuration is prepared only                          |
| `/status` live probes                   | API health is queried; implementation and connectivity are shown separately |
| Browser/E2E and visual regression tests | Not present                                                                 |
| Hosted surfaces                         | None                                                                        |

Readiness: a functioning local vertical slice (mirror → core → API → SDK/CLI →
Studio) with one live Rabdi record verified end-to-end. It is not deployed and
does not yet cover event writes, internal call traces or a global signature
registry.

---

## 5. Honest caveats

1. **Limited live Arkiv coverage.** Only one function record is verified.
   Other records and event signatures have not been imported.
2. **Derived-source policy.** OpenZeppelin/ERCs replace the blocked
   `ethereum-lists/4bytes` source (PRD QG-03). This is Sourcify-free and
   attributable but is not the PRD's named registry and needs product sign-off.
3. **Transaction analysis is not tracing.** It retrieves the transaction and
   receipt, decodes top-level calldata and emitted logs; internal calls are out
   of scope and stated as such.
4. **Events are readable but not yet written.** The `atlas.event-signatures`
   read adapter and schema exist; the importer does not write events yet, so a
   configured registry returns valid empty results until an approved import.
5. **Public writes are irreversible in effect.** Expiry is 180 days with no
   renewal or rollback implemented.
6. **Serverless rate limiting is per process.** Vercel can scale multiple
   instances, so use an edge/WAF or shared rate-limit service for aggregate
   abuse control.
7. **No Git history**, so PRD QG-01 remains unmet.

---

## 6. Recommended next steps

1. Move local credentials out of the OneDrive-synchronized directory.
2. Create and review an approved Git repository; deployment was not authorized
   or performed in this task.
3. Configure the two Vercel projects and production variables using
   [docs/vercel-deployment.md](vercel-deployment.md), then smoke-test hosted
   routes and exact-origin CORS after separate deployment approval.
4. Implement approved event-signature writes and decide whether the derived
   data-source policy satisfies the product requirements.
5. Add browser/E2E tests and shared/edge rate limiting before significant
   public traffic.
