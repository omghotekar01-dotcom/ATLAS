# Explorer coverage and 0G demonstration — ETHGlobal Mumbai

## Why common selectors can return no Arkiv matches

The ATLAS API queries **only source-provenance-aware records actually imported into the trusted Arkiv registry**. A working Arkiv connection does not imply that all OpenZeppelin signatures or all 3,892 declarations in the exported Swarm archive were indexed in Arkiv.

- Verified live Arkiv example: `0x9010d07c` → `getRoleMember(bytes32,uint256)`.
- The famous ERC-20 `0xa9059cbb` → `transfer(address,uint256)` currently has **no imported canonical Arkiv record**.
- Explorer now makes a second, separately attributed **read-only** request to `/v1/community/4byte/:selector` only when a selector lookup returns no canonical candidates.
- Community candidates are **unverified hints**, not canonical Arkiv records, ABI ownership evidence, or guaranteed contract interpretations.
- Sample Preview remains OFF by default; turning it ON displays explicit **sample-data** labels.

To actually expand the authoritative Arkiv database, a trusted signer must approve a fresh import and verify on-chain writes and indexed read-back. This is a separate operation; the UI fallback does not fabricate canonical records. The original code and deployed APIs remain usable without credentials.

## Fast judge demo for Explorer

1. Open https://atlas-ethglobal.vercel.app/explorer (Sample preview: OFF).
2. Click `0x9010d07c` to run a verified Arkiv lookup; open the entity and publisher evidence.
3. Click `0xa9059cbb`; Arkiv reports not indexed, then 4byte.directory returns community candidates. The UI must **not** promote these to Arkiv.
4. Point out the source/collision boundaries and the ability to inspect the raw 4byte.directory JSON.

## 0G Private Computer — real integration vs local illustration

The repository already implements a bounded **server-side** adapter at `services/api/src/zero-g.ts`, called by `POST /v1/explain`. It decodes the input using canonical Arkiv provenance, uses an OpenAI-compatible `https://router-api.0g.ai/v1/chat/completions` request with private trust mode, and returns only a provider response if successful.

To enable **real 0G inference**, in the authorized Vercel project environment add:

| Server variable                 | Value                                                                                                   |
| ------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `ATLAS_0G_API_KEY`              | Private Computer API key created in your 0G account; keep it server-side only                           |
| `ATLAS_0G_MODEL`                | Exact available private-compatible chat model ID from https://pc.0g.ai/models                           |
| `ATLAS_0G_ALLOW_PUBLIC_EXPLAIN` | `true` only if willing to expose bounded server-paid requests to visitors; enforce usage limits/credits |

Redeploy after updating the **production** environment. Do **not** put the key in `VITE_` variables or the GitHub repository. The existing API has per-IP rate limiting; this is **not** a complete cost-cap solution, so use provider-side caps and disable public inference when credits are not available.

Demo flow: open `/decode`, click **Load live Arkiv example**, press **Decode**, then choose:

- **Preview local illustration:** deterministic explanatory placeholder visible on the page, marked `LOCAL ILLUSTRATION / NOT 0G INFERENCE`. It calls **no** 0G service, spends no credits and has **no provider ID**. This previews the intended product workflow only.
- **Request REAL 0G inference:** sends a real request through the server adapter using canonical decoded evidence. Only a real 0G provider response can display a model and request ID. If unconfigured, it fails visibly; no output is invented.

The **0G Private Computer prize** requires a genuine inference call in the primary flow, a request ID and a compelling product use case; the illustrated mode does **not** satisfy the prize. See https://ethglobal.com/events/mumbai/prizes and https://pc.0g.ai/.

## Scope and limitations

- Swarm archive records have not yet been bulk-indexed into Arkiv.
- Community suggestions are not new canonical records.
- ENSv2 registrar role reads do not bind ABI authorship.
- The 0G illustration is clearly labeled; live private inference needs credentials and credits.
- Do not suggest that hidden shortlisting automation can be bypassed or manipulate eligibility. Show reproducible proof instead.
