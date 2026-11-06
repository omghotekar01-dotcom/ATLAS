# ATLAS ENSv2 — Evidence-driven permissioned role check

**Status:** A read-only integration path is implemented in this feature patch; **live ENSv2 evidence is not yet verified**. One `hasRoles()` read is not a complete publisher-identity proof.

## Why it matters

ENSv2 uses Enhanced Access Control (EAC) in PermissionedRegistry and PermissionedResolver contracts. ATLAS can query `hasRoles(resource, roleBitmap, account)` and `roles(resource, account)` against a **configured Sepolia** registry without writing, purchasing a name, or claiming control of a contract. The request also captures the block number. Clients must not interpret a positive result at one resource as ownership of an ABI or unrelated smart contract.

Official references:

- https://docs.ens.domains/ensv2/enhanced-access-control/
- https://docs.ens.domains/ensv2/permissioned-registry/
- https://docs.ens.domains/learn/deployments/

## Configure on the API only

```
ATLAS_RPC_URL_11155111=https://<public-or-private-sepolia-rpc>
ATLAS_ENSV2_REGISTRY=0x<verified-Sepolia-ENSv2-PermissionedRegistry>
```

**Verify the registry address** against the current ENSv2 Sepolia deployment or a verified per-name registry before describing it as official ENSv2. Do not use the ENSv1 registry address merely because it is well known. Never copy a private RPC key to a `VITE_` browser setting.

## Requests

```
GET /v1/ensv2/roles/:account?resource=0&role=16777216
atlas ens-role 0x<40-hex-account> --resource 0 --role 16777216 --json
```

Defaults are resource `0` (**root**, not a specific name) and role `1 << 24` (`ROLE_SET_RESOLVER` for PermissionedRegistry). For a name-scoped check, compute and verify the contract's exact current resource ID using ENSv2 documentation, then pass it as decimal.

The result is a JSON object containing `authorized`, `roleBitmap`, `blockNumber`, actual Sepolia chain ID, contract and account addresses, and warnings. 0G or 4byte records never grant EAC roles.

## Prove it to judges

1. Open ENSv2's canonical Sepolia contract deployment and record address / source.
2. Find a registry and one role-authorized and one non-authorized account for the chosen resource.
3. Run the same `atlas ens-role` command for both addresses and capture different real `authorized` results and block number.
4. Verify the returned state independently in a block explorer or via a separate RPC client.
5. If available, demonstrate an authorized change and denied change through the actual ENSv2 contracts **only after independent wallet/fee approval**. This feature does **not** contain any writes.

**Completion gate:** Live authorized and denied EAC role evidence, namespaced publisher discovery, and reproducible contract addresses. Until then, mark ENSv2 **partial**.

The API defaults to Sepolia. Set `ATLAS_ENSV2_CHAIN_ID=1` and `ATLAS_RPC_URL_1` to target Ethereum Mainnet. Verify `ATLAS_ENSV2_REGISTRY` against the [official deployment table](https://docs.ens.domains/learn/deployments/).

To check an active registration against the official ENSv2 registry, use `atlas publisher <account> --name <name.eth> --json`. The named response contains the registered owner, resolver, current EAC resource and role at one block. ATLAS follows up to two explicit subregistries and does not query wildcard or offchain record data.

A read-only Sepolia probe at block `12078581` returned `authorized=false` and bitmap `0` for `0x000000000000000000000000000000000000dead`, root resource `0`, against [the official Sepolia ETHRegistry](https://sepolia.etherscan.io/address/0xd4ebcbbdf463c9c45784603db0ddd499bc44a8b4). The Mainnet probe did not complete. A separate authorized name-scoped example remains pending.
