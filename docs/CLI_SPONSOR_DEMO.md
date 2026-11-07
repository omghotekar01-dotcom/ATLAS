# ATLAS CLI — actual investigation and sponsor demonstrations (November 7, 2026)

The CLI is not just a launcher. The **source checkout** now performs actual ATLAS backend calls and returns independently labeled evidence.

## Run immediately from source

```powershell
cd C:\projects\ATLAS-IMPORT
git pull --ff-only origin main
corepack pnpm install --frozen-lockfile
corepack pnpm --filter '@atlas/cli...' build
node packages/cli/dist/bin.js demo
```

`atlas demo` performs all of these read-only actions:

1. **Arkiv** — query the live trusted-creator Rabdi function entity for `0x9010d07c` and show canonical source provenance.
2. **Decoder** — decode `getRoleMember(bytes32,uint256)` calldata through the real API, not a frontend fixture.
3. **Swarm** — retrieve the pinned root manifest, compare its actual SHA-256 to the verified receipt.
4. **ENSv2** — run actual granted and denied Sepolia EAC role reads, showing the block numbers.
5. **0G-style preview** — generate an explicit LOCAL illustration with **no** provider request, key, model, or request ID.
6. **Ethereum Foundation Anon-RPC** — clearly report that this **Node CLI made no private RPC request**. Provide the link to the separately runnable **real Nym browser harness**.

All responses can be printed as structured JSON:

```powershell
node packages/cli/dist/bin.js demo --json
```

## Inspect arbitrary Ethereum selectors and calldata

```powershell
node packages/cli/dist/bin.js inspect 0x9010d07c
node packages/cli/dist/bin.js inspect 0xa9059cbb
node packages/cli/dist/bin.js inspect 0x9010d07c --full --json
node packages/cli/dist/bin.js inspect 0x9010d07c00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000 --full
```

Unknown selectors may return **community hints** from 4byte.directory, explicitly unverified. No community data is inserted into the canonical Arkiv database.

## 0G

The real integration uses a server-side API key and model on the ATLAS backend. Use:

```powershell
node packages/cli/dist/bin.js demo --0g-live --json
```

The request will fail visibly if 0G is unconfigured or returns no provider ID. It will never fake a 0G receipt. The ordinary `demo` command uses the strictly labeled local preview.

To configure on the Vercel **API project** (never expose keys via GitHub, a client `VITE_` variable, or CLI output):

- `ATLAS_0G_API_KEY` — real key from https://pc.0g.ai/
- `ATLAS_0G_MODEL` — an actually private-compatible model ID from https://pc.0g.ai/models
- `ATLAS_0G_ALLOW_PUBLIC_EXPLAIN=true` — only when server-paid requests and provider-side caps are approved

## Ethereum Foundation Anon-RPC: real browser demo

Open https://atlas-ethglobal.vercel.app/integrations and click **Run one-click LIVE Anon-RPC check**. The project uses the real `@anon-rpc/browser-harness` and Nym worker to try `eth_blockNumber`.

- The public Ethereum RPC URL is prefilled; it is editable if a provider does not permit CORS.
- One specifier bootstrap read is **direct**; the block-number request is attempted via the Nym worker.
- A failed worker request is **not** silently replaced by a direct RPC read, and no fake block height is shown.
- Transaction Lab starts in private Nym mode, with direct mode opt-in. Other ATLAS endpoints still use server-side direct RPC where applicable; the whole application is **not** default-anonymous yet.

These demonstrations are real where labeled real and illustrative where labeled illustrative. Neither a fake 0G completion nor a fabricated Anon-RPC success establishes sponsor prize qualification.

## Release distinction

Source CLI uses `@atlas/cli` version `0.1.1`. The npm-distributed package `@omghotekar/atlas-cli` must be published separately with a new compatible version **before** advertising the new `inspect` or `demo` commands as available via `npx`. Until published, run the compiled source checkout as above.

Git commits created for this project must be authored `Om Ghotekar <omghotekar01@gmail.com>`.
