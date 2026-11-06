# ATLAS live Arkiv proof

**Verified:** 2026-11-06  
**Scope:** One function-signature entity on Arkiv Rabdi. This is not evidence
that the rest of the source dataset has been imported.

## Network and write

| Field                       | Verified value                                                                                                                       |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Network                     | Arkiv Rabdi testnet                                                                                                                  |
| Chain ID                    | `7794095` (`0x76edaf`)                                                                                                               |
| RPC                         | `https://rpc.rabdi.db-chain.testnet.arkiv.network`                                                                                   |
| Signer / transaction sender | `0xAd797f58aFD3265C00504382171eC0818262D3ca`                                                                                         |
| Transaction hash            | `0x0ddf2304bc90eacf5430c0d253cf8560f7b3dbbbf62f58f77c7b8a7347623594`                                                                 |
| Transaction status          | Success (`0x1`)                                                                                                                      |
| Block                       | `283920`                                                                                                                             |
| Gas used                    | `558371`                                                                                                                             |
| Effective gas price         | `1000000000` wei                                                                                                                     |
| Actual fee                  | `558371000000000` wei = `0.000558371` tGLM                                                                                           |
| Explorer                    | [View Rabdi transaction](https://rabdi.explorer.arkiv.network/tx/0x0ddf2304bc90eacf5430c0d253cf8560f7b3dbbbf62f58f77c7b8a7347623594) |

The import report records the transaction hash. The receipt was verified with
read-only `eth_getTransactionReceipt` against Arkiv's public Rabdi RPC; its
sender matches the address in the import preflight evidence. The reported fee
is calculated from the receipt's `gasUsed × effectiveGasPrice`; it is not the
preflight estimate.

## Source and function

- Repository: [OpenZeppelin/openzeppelin-contracts](https://github.com/OpenZeppelin/openzeppelin-contracts)
- License: [MIT at the pinned commit](https://github.com/OpenZeppelin/openzeppelin-contracts/blob/efaa6f78ab1dde05416246e801c0baaf4f900d49/LICENSE)
- Pinned commit: [`efaa6f78ab1dde05416246e801c0baaf4f900d49`](https://github.com/OpenZeppelin/openzeppelin-contracts/commit/efaa6f78ab1dde05416246e801c0baaf4f900d49)
- Dataset version: `openzeppelin-contracts@efaa6f78ab1d-2026-11-06`
- Source ID: `efaa6f78ab1dde05416246e801c0baaf4f900d49:access/extensions/AccessControlEnumerable.sol:36:getRoleMember(bytes32,uint256)`
- Function: `getRoleMember(bytes32,uint256)`
- Selector: `0x9010d07c`

## Entity and verification

- Entity key: `0x99f6593a55a1ae91590399a059adad2cfb8faa4cf69471d7f23a053ba407a034`
- Record hash: `0x006ec394910203bf6b314b2ac4a0135526ec97c300425ee49b50847603c96689`
- Import report: [`docs/reports/openzeppelin-contracts@efaa6f78ab1d-2026-11-06-import.json`](./reports/openzeppelin-contracts@efaa6f78ab1d-2026-11-06-import.json)
- Result: `1` written, `1` read-back verified, `0` write failures, `0` missing or mismatched read-backs.
- Checkpoint: `importer/.atlas-checkpoints/openzeppelin-contracts@efaa6f78ab1d-2026-11-06.json` recorded `completed`, one written record hash, and no skipped or failed checkpoint entries. The checkpoint does not contain a transaction receipt.

The import report has the canonical transaction hash and entity key. Neither
the report nor checkpoint records the block or paid fee; those values above
come from the read-only Rabdi transaction receipt. The checkpoint does not
record the signer; the matching sender was confirmed from the receipt and
preflight evidence.

## API and Studio evidence

- `GET /v1/functions/0x9010d07c` returned HTTP `200` with
  `getRoleMember(bytes32,uint256)` from `OpenZeppelin/openzeppelin-contracts`,
  including the same entity key, record hash, and dataset version.
- The Studio Explorer was browser-verified to display that same live Arkiv
  record. Sample preview is opt-in and is separate from this result.
- CORS was browser-tested with an exact allowed origin; unapproved origins are
  not wildcard-enabled.

These observations verify one live record only. Other selectors can return a
valid empty result; an unavailable API or Arkiv upstream is an error/degraded
state, not a sample-data fallback.

## Read-only reproduction

Configure `ARKIV_ACCESS_KEY` and `ATLAS_ARKIV_CREATOR_ADDRESS` in the API's
server environment. Do not configure `ARKIV_PRIVATE_KEY` for this read-only
check.

```sh
pnpm --filter @atlas/api dev
curl -i http://127.0.0.1:3000/health
curl -i http://127.0.0.1:3000/v1/functions/0x9010d07c
```

For Studio, set `VITE_ATLAS_API_URL` to that API origin and run
`pnpm --filter @atlas/studio dev`; open Explorer and search `0x9010d07c`.
These steps only read the existing entity. Do not rerun an import or send a
transaction to reproduce this proof.
