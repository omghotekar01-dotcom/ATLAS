# Arkiv write plan (Gate D)

**Status: One function record was written and verified. No follow-up import is
approved.**

The single-record live evidence is in
[docs/arkiv-live-proof.md](arkiv-live-proof.md). This plan is retained for
follow-up write reviews; do not rerun its historical import commands to
reproduce the proof.

## 1. Target

| Item           | Value                                                 |
| -------------- | ----------------------------------------------------- |
| Network        | Rabdi testnet                                         |
| Chain ID       | `7794095` (`0x76edaf`)                                |
| RPC host       | `rpc.rabdi.db-chain.testnet.arkiv.network`            |
| Schema         | `atlas.function-signatures`                           |
| Entity expiry  | `ExpirationTime.fromDays(180)` (≤ `7_884_000` blocks) |
| Write batching | 25 per batch, hard limit 100                          |
| Write retries  | none; an uncertain outcome is reported as a failure   |

Writes are public testnet writes. They are irreversible in effect from the
importer's perspective: there is no delete or rollback path, and renewal is not
implemented.

## 2. Account and creator

Before approval, record:

- signer address derived from `ARKIV_PRIVATE_KEY` (never print the key);
- `ATLAS_ARKIV_CREATOR_ADDRESS`, which must equal that signer;
- testnet balance and the funding source.

The importer refuses to write if the signer differs from the trusted creator.
`atlas-importer doctor` shows the signer and whether it matches. The API uses the
same `ATLAS_ARKIV_CREATOR_ADDRESS` for read filtering, so a mismatch would make
written records invisible.

## 3. Record and provenance

The confirmed write is one OpenZeppelin function record:

| Dataset                                          | Commit                                     | Written | Read-back verified | Failures |
| ------------------------------------------------ | ------------------------------------------ | ------: | -----------------: | -------: |
| `openzeppelin-contracts@efaa6f78ab1d-2026-11-06` | `efaa6f78ab1dde05416246e801c0baaf4f900d49` |       1 |                  1 |        0 |

The pinned-source dry run found 544 writable functions and 159 deferred
events. Those are not live-import counts; only the one record in the proof
document is confirmed on Arkiv.

Events are extracted but **not written** yet: the `atlas.event-signatures`
read schema exists, while the importer event-write path remains PRD phase 10. ERCs remain a second, separately approved import:

| Dataset                                 | Commit                                     | Functions | Rejected |
| --------------------------------------- | ------------------------------------------ | --------: | -------: |
| `ethereum-ercs@7dafd1125ffb-2026-11-04` | `7dafd1125fffbd3832316edeb739608ad82bb4c4` |     2,611 |       36 |

Each record carries:

- `source`, `sourceId` = `<commit>:<file>:<line>:<signature>`;
- `datasetVersion`, `importedAt`, deterministic `recordHash`;
- the licence and tree digest bound to the checkpoint.

Evidence: `docs/reports/openzeppelin-contracts-efaa6f78ab1d-dry-run.json`,
`docs/reports/ethereum-ercs-7dafd1125ffb-dry-run.json`,
`docs/reports/dataset-assessment.md`.

## 4. Measured fee for the confirmed write

The receipt for the single confirmed write reports:

- gas used: `558371`;
- effective gas price: `1000000000` wei;
- paid fee: `558371000000000` wei (`0.000558371` tGLM).

This is the actual fee for one payload, not a batch estimate or a forecast for
additional writes. Any future write needs a fresh preflight and separate
approval.

## 5. Preflight for any future write

The following commands describe a future, separately approved workflow only.
They were not run to produce the current proof:

```sh
export ARKIV_ACCESS_KEY=...                 # read access
export ARKIV_PRIVATE_KEY=0x...              # funded Rabdi signer
export ATLAS_ARKIV_CREATOR_ADDRESS=0x...    # must equal the signer

node importer/dist/cli.js doctor --json
node importer/dist/cli.js snapshot --source openzeppelin-contracts
node importer/dist/cli.js dry-run \
  --source openzeppelin-contracts \
  --fetch \
  --dataset-version openzeppelin-contracts@efaa6f78ab1d-2026-11-02 \
  --report /tmp/oz-final-dry-run.json
```

Required preflight results:

- `doctor` reports `health.status = "ok"` and `chainId = 7794095`;
- signer equals `ATLAS_ARKIV_CREATOR_ADDRESS`;
- dry run reports 544 writable functions, 0 rejected, 0 selector collisions;
- report is archived as evidence.

## 6. Approval gate for future writes

No additional write may proceed without explicit Gate D approval stating:

1. network: Rabdi testnet, chain `7794095`;
2. signer/creator address;
3. record count and dataset version;
4. provenance model (commit/file/line/signature, licence hash, tree digest);
5. measured gas and total cost;
6. irreversibility and 180-day expiry;
7. exact approval token, which is the dataset version.

Only after that separate approval, and never as part of a read-only proof:

```sh
export ATLAS_WRITE_APPROVAL=openzeppelin-contracts@efaa6f78ab1d-2026-11-02
node importer/dist/cli.js import \
  --source openzeppelin-contracts \
  --source-dir <pinned-checkout>/contracts \
  --dataset-version openzeppelin-contracts@efaa6f78ab1d-2026-11-02 \
  --batch-size 25 \
  --confirm-write \
  --report /tmp/oz-import-report.json
```

## 7. Verification after writing

```sh
node importer/dist/cli.js verify --report /tmp/oz-import-report.json --json
```

Verification reads every written entity back by `recordHash` and compares its
content. A mismatch is a failure, not a warning.

For the already completed read-only proof, query the existing record without
running the importer:

```sh
curl -s http://127.0.0.1:3000/v1/functions/0x9010d07c
```

## 8. Abort conditions

Stop immediately if:

- the chain ID is not `7794095`;
- the signer differs from the trusted creator;
- the licence hash or tree digest differs from the pinned values;
- the dry run has rejections or selector collisions;
- gas cannot be measured or exceeds the approved amount;
- any write outcome is uncertain (no blind retry);
- read-back verification differs.

## 9. Rollback

None. Expiry removes records after about 180 days. Any correction requires a
separate approved write plan.
