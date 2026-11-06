# ATLAS EF Anon-RPC — real Nym worker browser path

**Status:** The integration code wires the actual `@anon-rpc/browser-harness@0.3.0` to the **Nym mixnet** mainnet specifier. It is a browser-only path; **live request and anonymity evidence are pending**.

Official references:

- https://ethereum.github.io/anon-rpc/wallets/
- https://ethereum.github.io/anon-rpc/adopters/
- https://ethereum.github.io/anon-rpc/spec/

## The isolation boundary

The browser harness verifies the selected worker bundle against its on-chain Keccak-256 hash before loading it into a null-origin iframe/worker. The Nym worker is selected by the official mainnet specifier `0x3aCD9742C68F6d993066Ae25533e09b9e1f60eD0`. **Do not use the passthrough worker**: its requests are plain fetches and are not anonymous.

The Studio Integrations page offers a real `eth_blockNumber` request through `worker.fetch`. A **one-time direct bootstrap RPC** reads the worker specifier so the anonymity network can start. This bootstrap is **not** anonymous; show that clearly. Supply public HTTPS RPC URLs, not a key-bearing private endpoint. The worker may download a large (~18 MiB) WASM bundle and take time to bootstrap.

The user must explicitly click `Read block through Nym`. On worker/transport/network failure the UI displays a real error and does **not** silently substitute a standard RPC call.

## Browser verification

1. Run Studio with the new dependency installed; navigate to `/integrations`.
2. Supply a public mainnet bootstrap RPC endpoint and public destination RPC endpoint, both HTTPS without API keys.
3. Start the Nym worker and record the specifier, successful hash-verified readiness, and returned Ethereum block number.
4. Compare block height to another public explorer only to check plausibility, **not** to claim anonymity.
5. Inspect the browser network panel: bootstrap direct, subsequent JSON-RPC fulfilled by `worker.fetch`. Capture the exit/network proof provided by Nym if available.
6. Verify failure with an invalid bootstrap or disabled network: no direct fallback, no false green status.

**Core limitation:** This specific Anon-RPC harness works in browsers. Node.js CLI and server-side transaction analysis remain **direct configured RPC** and must be explicitly labelled so. Do not claim all ATLAS RPC calls are anonymous.

**Completion gate:** One genuine worker-mediated read and transport proof; default routing and privacy coverage documented separately. Until then status remains **partial/not live verified**.
