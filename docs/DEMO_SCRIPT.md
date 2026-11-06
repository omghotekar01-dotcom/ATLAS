# ATLAS — short, proof-first live demo

Target length: approximately 2–3 minutes. Speak live using your own voice;
do not claim that unimported data or unshipped features are live.

**0:00–0:20 — The problem.** "An Ethereum transaction carries opaque
selectors and event topic hashes. A signature catalogue can tell you a
meaning, but how do you verify where that answer came from?"

**0:20–0:45 — Our solution.** "ATLAS extracts declarations from pinned
licensed first-party Solidity source and stores their selectors, signatures
and source-level provenance as wallet-created Arkiv Rabdi entities with
expiration and indexed filters."

**0:45–1:15 — Live proof.** Open
`https://atlas-api-ivory.vercel.app/v1/functions/0x9010d07c`.
Point to `getRoleMember(bytes32,uint256)`, the source commit, entity key,
record hash and `registry:"arkiv-rabdi"`. Open the matching
[real transaction](https://rabdi.explorer.arkiv.network/tx/0x0ddf2304bc90eacf5430c0d253cf8560f7b3dbbbf62f58f77c7b8a7347623594)
and show its success.

**1:15–1:50 — Studio.** Once the hosted site is deployed, open Explorer and
enter `0x9010d07c`. Show a real result. Toggle the sample-preview switch and
explain that preview content is explicitly labeled. Open Decoder or
Transaction Lab to explain the real APIs, but do not pretend unknown selectors
are resolved.

**1:50–2:15 — Safety and architecture.** Show `/arkiv/schema.md`, the import
script and its `ATLAS_WRITE_APPROVAL` gate, the explicit creator filter and
the 180-day expiry. Explain read-back verification and that the API does not
carry a signing private key.

**2:15–2:40 — Truthful scope and next.** "We have proven one live entity.
Our offline source pipeline finds 3,787 distinct signatures, and the next
steps are approved bulk imports, event writes and refresh automation."

## Fallback if Studio is unavailable

Present the production API, GitHub source/test evidence and Rabdi transaction.
Never represent a fixture screenshot as an Arkiv-backed live result.
