# Mirrored dataset assessment

Date: 2026-11-06. Scope: the two pinned, licence-verified sources that replace
the blocked `ethereum-lists/4bytes` dataset. These are **real, full-source dry
runs**, not the synthetic importer fixtures.

| Source                   | Commit                                     | Licence | Files | Declarations | Validated | Functions | Events | Rejected |
| ------------------------ | ------------------------------------------ | ------- | ----: | -----------: | --------: | --------: | -----: | -------: |
| `openzeppelin-contracts` | `efaa6f78ab1dde05416246e801c0baaf4f900d49` | MIT     |   376 |        1,239 |       703 |       544 |    159 |        0 |
| `ethereum-ercs`          | `7dafd1125fffbd3832316edeb739608ad82bb4c4` | CC0-1.0 |   734 |        5,594 |     3,189 |     2,611 |    578 |       36 |

Union: **3,787 distinct signatures**. Selectors are recomputed with `viem` from
the canonical signature; no selector collision exists inside either source or
across the two sources.

Metadata: `openzeppelin-contracts@efaa6f78ab1d-2026-11-02` (tree digest
`0x94539228…`, 1,009 files / 12,835,941 bytes) and
`ethereum-ercs@7dafd1125ffb-2026-11-04` (tree digest `0x4308ded3…`).

## What it covers

Every record carries commit/file/line provenance
(`<commit>:<path>:<line>:<signature>`) and a deterministic `recordHash`.
Coverage of the canonical interfaces ATLAS users are most likely to inspect:

- **ERC-20**: `transfer`, `transferFrom`, `approve`, `allowance`, `balanceOf`,
  `totalSupply`, `name`, `symbol`, `decimals`, plus the events.
- **ERC-721/1155**: `ownerOf`, `safeTransferFrom`, `setApprovalForAll`,
  `isApprovedForAll`, `tokenURI`, `balanceOfBatch`,
  `safeBatchTransferFrom`, `supportsInterface`.
- **ERC-4626** (OZ only): `deposit`, `redeem`, `asset`, `totalAssets`,
  `convertToShares`, `convertToAssets`.
- **Access and governance**: `AccessManager`, `TimelockController`,
  `AccessControlEnumerable`, `Governor`-family functions.
- **ERC standard interfaces**: the `ethereum/ERCs` repository contributes
  reference interfaces beyond the core EIPs.

The ERCs repository does not contain ERC-4626; OZ supplies it. This is a source
coverage fact, not a decoding gap.

## Rejections (ERCs, 36 records in 25 files)

| Reason                              | Count |
| ----------------------------------- | ----: |
| Conflicting user-defined type shape |    25 |
| Unknown user-defined type           |     8 |
| Parser: expected comma              |     1 |
| Parser: internal null node          |     1 |
| Parser: malformed source            |     1 |

Rejections are structured and recorded per file; no type is guessed and no
record is silently dropped. OpenZeppelin had zero rejections.

## Relevance

- **Function lookup/decode**: high. The dataset covers the dominant token,
  access-control, governance, proxy and utility surfaces with line-level
  provenance.
- **Event decoding**: extraction is complete (737 events), but Arkiv **event
  writes are not implemented yet** (PRD phase 10). `GET /v1/events/:topic0`
  therefore returns valid empty results until an approved event import populates
  the new `atlas.event-signatures` schema.
- **Transaction analysis**: calldata and logs are decoded against these
  candidates. Internal calls are not traced or decoded; the API states this
  limitation explicitly.

## Honest limitations

- These are Solidity declarations, not a global signature database. Unknown
  selectors are common and return an empty result, never a guess.
- The importer resolves symbols per file; declarations that need cross-file
  compiler resolution remain rejected.
- The ERCs set contains reference implementations that may never be deployed;
  presence in the dataset does not imply on-chain usage.
- The two dry runs are the evidence of record. The synthetic fixtures
  (3 files / 13 declarations / 11 validated / 2 rejected) are used only by the
  test suite and must not be quoted as dataset coverage.
- The live consistency proof against Rabdi still requires credentials
  (`ARKIV_ACCESS_KEY`, `ATLAS_ARKIV_CREATOR_ADDRESS`). The recorded run used an
  in-memory repository; it proves CLI = SDK = REST behaviour, not live data.

## Reproduce

```sh
node importer/dist/cli.js dry-run \
  --source openzeppelin-contracts \
  --source-dir <checkout>/contracts \
  --dataset-version openzeppelin-contracts@efaa6f78ab1d-2026-11-02 \
  --report docs/reports/openzeppelin-contracts-efaa6f78ab1d-dry-run.json

node importer/dist/cli.js dry-run \
  --source ethereum-ercs \
  --source-dir <checkout>/assets \
  --dataset-version ethereum-ercs@7dafd1125ffb-2026-11-04 \
  --report docs/reports/ethereum-ercs-7dafd1125ffb-dry-run.json
```
