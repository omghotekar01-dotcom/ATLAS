# ATLAS ENSv2 publisher permission evidence

ATLAS Studio now places a **read-only ENSv2 role check next to an Arkiv canonical signature candidate**. The user supplies a publisher wallet and, optionally, an `.eth` name. The app calls `GET /v1/ensv2/roles/:account` with either a name or root resource, plus the chosen role, and displays the block-pinned Sepolia EAC response. It can copy one evidence JSON object containing both the Arkiv source record and the ENSv2 permission result.

**Trust boundary:** The records are juxtaposed, not bound. `sourceBindingVerified=false` is intentional: neither an ENSv2 registry role nor name ownership is evidence that this account authored, published, or signed the shown ABI. A true publisher-to-source binding requires an independent signed or on-chain attestation tied to the exact record hash, which is **not implemented**.

## Live judge flow

1. Open https://atlas-ethglobal.vercel.app/explorer and ensure Sample Preview is **off**.
2. Look up selector `0x9010d07c` to get the real `getRoleMember(bytes32,uint256)` Arkiv candidate with provenance.
3. Expand **Check ENSv2 publisher permission** in that candidate card.
4. Click **Live authorized root-role example** to check `0xf633e7fc17e2bbe0d0965d18ec1821dcb754a3d3` for role `1` at root resource `0`; the live Sepolia API has previously returned `authorized=true`.
5. Click **Live denied root-role example** to check ATLAS writer wallet `0xAd797f58aFD3265C00504382171eC0818262D3ca` for the same root role; previously `authorized=false`.
6. Inspect on-chain block number, registry, account, role bitmap and the warning **Source-to-publisher binding: NOT VERIFIED**. Copy the combined evidence JSON.
7. Optionally open https://atlas-ethglobal.vercel.app/integrations for advanced ENS name and resource mode.

## Reproducible API calls

```sh
curl -fsS 'https://atlas-ethglobal.vercel.app/v1/ensv2/roles/0xf633e7fc17e2bbe0d0965d18ec1821dcb754a3d3?resource=0&role=1'
curl -fsS 'https://atlas-ethglobal.vercel.app/v1/ensv2/roles/0xAd797f58aFD3265C00504382171eC0818262D3ca?resource=0&role=1'
curl -fsS 'https://atlas-ethglobal.vercel.app/v1/functions/0x9010d07c'
```

Use a new on-chain read during judging; do not portray previous block numbers as current. Read operations do not require a private key or gas.
