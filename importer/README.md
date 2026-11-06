# ATLAS importer

Deterministic extraction of function and event signatures from **first-party
Solidity source** pinned to a commit, followed by validation, content hashing,
checkpointed writes, and read-back verification.

The importer does **not** use Sourcify, and it does not use mixed-provenance
databases. The PRD's `ethereum-lists/4bytes` source remains blocked because its
records cannot be separated from Sourcify-derived entries; see
[`../docs/data-quality.md`](../docs/data-quality.md). The sources below are
first-party Solidity repositories with verified licences, so every record can be
attributed to a commit, a file path, a line, a declaration and a licence.

## Pinned sources

| Source ID                | Repository                            | Commit                                     | Licence |
| ------------------------ | ------------------------------------- | ------------------------------------------ | ------- |
| `openzeppelin-contracts` | `OpenZeppelin/openzeppelin-contracts` | `efaa6f78ab1dde05416246e801c0baaf4f900d49` | MIT     |
| `ethereum-ercs`          | `ethereum/ERCs`                       | `7dafd1125fffbd3832316edeb739608ad82bb4c4` | CC0-1.0 |

Licences are pinned by the SHA-256 of the stored git blob (LF content). The
checkout used for a run must match that hash; otherwise the run aborts.

## Build and test

```sh
pnpm install --frozen-lockfile
pnpm --filter @atlas/importer typecheck
pnpm --filter @atlas/importer test
pnpm --filter @atlas/importer build
```

## Commands

```
node importer/dist/cli.js snapshot --source <id> [--cache <dir>] [--force] [--json]
node importer/dist/cli.js dry-run  --source <id> (--fetch | --source-dir <path>) [--dataset-version <id>] [--report <file>] [--json]
node importer/dist/cli.js import   --source <id> (--fetch | --source-dir <path>) --confirm-write   [--dataset-version <id>] [--batch-size 1..100] [--checkpoint <file>] [--resume|--fresh]   [--max-records <n>] [--report <file>] [--json]
node importer/dist/cli.js verify   --report <file> [--json]
node importer/dist/cli.js doctor   [--json]
```

`--source-dir` is the Solidity root inside a checkout of the pinned commit
(`contracts` for OZ, `assets` for ERCs).

### Snapshot and dry run (offline, no credentials)

`snapshot` performs a shallow `git fetch` of the pinned commit into
`importer/.snapshots/<id>/<sha>` (override with `--cache`), asserts that `HEAD`
equals the pinned SHA and verifies the licence hash. `dry-run` reads either the
cached snapshot (`--fetch`) or a local checkout (`--source-dir`), extracts and
validates signatures and prints a report. Neither command constructs an Arkiv
client.

```sh
node importer/dist/cli.js dry-run \
  --source openzeppelin-contracts \
  --source-dir /tmp/oz/contracts \
  --dataset-version openzeppelin-contracts@efaa6f78ab1d-2026-11-02 \
  --report /tmp/atlas-oz-dry-run.json
```

Flags: `--json` writes one JSON document to stdout; `--report <file>` also
writes it to disk. Exit codes: `0` success, `1` operational failure, `2` invalid
usage.

### Import (public Arkiv write, approval required)

Writes are blocked by the PRD approval gate (Gate D) and by
`ATLAS_WRITE_APPROVAL`. Do not run this without explicit approval for the exact
testnet, account, record count, provenance, gas and irreversibility. The
approval package and preflight are in
[`../docs/arkiv-write-plan.md`](../docs/arkiv-write-plan.md).

```sh
export ARKIV_ACCESS_KEY=...
export ARKIV_PRIVATE_KEY=0x...
export ATLAS_WRITE_APPROVAL=1
node importer/dist/cli.js import \
  --source openzeppelin-contracts \
  --source-dir /tmp/oz/contracts \
  --dataset-version openzeppelin-contracts@efaa6f78ab1d-2026-11-02 \
  --confirm-write
```

The `pnpm` scripts (`snapshot`, `dry-run`, `import`, `verify`, `doctor`) load the
repo-root `.env` via `--env-file-if-exists=../.env`, so the variables above can
live there instead of the shell. A missing `.env` is not an error; the
`--confirm-write` gate is unaffected.

Before writing, the importer:

1. re-runs extraction and validation;
2. checks Rabdi chain ID `7794095` and the trusted creator;
3. verifies the snapshot licence hash;
4. resumes from an identity-bound checkpoint (batch 25, at most 100 records);
5. skips records whose `recordHash` is already present;
6. can be checked afterwards with `verify --report <file>`, which reads every
   written record back and compares content.

Writes are attempted once. An uncertain `createEntity` outcome is reported as a
failure and never retried blindly.

`doctor` reports configuration and connectivity without writing.

## What is extracted

- `external` and `public` named functions only (no constructor, fallback,
  receive, internal or private functions).
- Every `event` declaration; `indexed` is excluded from the canonical signature
  but preserved in record metadata when available.
- Canonical ABI types: `uint` → `uint256`, `int` → `int256`, `address payable` →
  `address`, `byte` → `bytes1`, fixed and dynamic arrays.
- Symbol resolution per file: contract types → `address`, enums → `uint8`,
  user-defined value types → their underlying type, structs → tuples.
- Selectors/topic0 are computed with `viem` and validated again by
  `viem` during normalization.

Declarations whose types remain unresolved, ambiguous or recursive are
**rejected with a structured reason**, not guessed. OpenZeppelin's full source
produced zero rejections; `ethereum/ERCs` produced 36 (conflicting or unknown
user-defined types and two parser limits). See
[`../docs/reports/dataset-assessment.md`](../docs/reports/dataset-assessment.md).

Events are extracted and reported but not written yet: the Arkiv
event-signature schema is not implemented (PRD phase 10).

## Records and hashes

Each record carries `source`, `sourceId`
(`<commit>:<file>:<line>:<signature>`), `importedAt`, `datasetVersion` and a
deterministic `recordHash` from `@atlas/schemas`. Identical signatures declared
in several files are collapsed to the lexicographically smallest source ID;
distinct signatures sharing one selector are never collapsed.

## Checkpoints

Checkpoints are versioned (`v1`), bound to the dataset identity (source, commit,
tree digest, licence hash) and written atomically. A mismatch aborts rather than
resuming against different data. They live in `.cache/` and are gitignored.

## Separate, approval-gated Arkiv event writes

The importer now includes an **event-only** writer. This is not executed by
`dry-run`, function `import`, or the deployed read-only Fastify API.

```sh
# This checks and reports source records without any blockchain write:
node importer/dist/cli.js dry-run --source openzeppelin-contracts --fetch --json

# After a separate on-chain approval and fresh fee preflight ONLY:
# ATLAS_WRITE_APPROVAL must be exactly "<datasetVersion>:events"
pnpm --filter @atlas/importer run import:events --source openzeppelin-contracts \
  --fetch --dataset-version openzeppelin-contracts@efaa6f78ab1d-2026-11-06 \
  --max-records 1 --batch-size 1 --confirm-write
```

The event writer requires `ARKIV_ACCESS_KEY`, the local
`ARKIV_PRIVATE_KEY` and an exactly matching `ATLAS_ARKIV_CREATOR_ADDRESS`.
Use a **fresh event-only checkpoint**, bounded batches and mandatory read-back.
Never place signing keys in GitHub Actions or the Vercel API. No additional
event entity has been written as part of the implementation.
