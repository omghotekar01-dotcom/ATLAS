# Reach — who uses Ethereum signature data?

Track: [Mirror something Ethereum depends on](https://ethglobal.com/events/mumbai/prizes).

## Who depends on this type of data?

Function selectors (4 bytes) and event `topic0` hashes are ubiquitous
interfaces for understanding EVM transactions, logs, calldata, wallet prompts,
block explorers and contract analysis. They are consumed by:

1. **Wallets and security tooling:** label function calls before users approve
   unfamiliar transactions; distinguish verified meanings from unknown selectors.
2. **Block explorers and forensic analysts:** decode transaction inputs and
   event logs with source-line provenance.
3. **Developer tools and agents:** resolve selectors through a stable API or
   typed SDK rather than hard-code opaque ABI guesses.
4. **Analytics/indexers:** annotate EVM telemetry and filter records by
   selector, source, dataset version or import timestamp.

These are **potential user segments**, not measured ATLAS users. We currently
have no verified DAU, production adoption, active client, or usage count.

## Concrete coverage and opportunity

- OpenZeppelin Contracts pinned-source dry run: **544 functions, 159 events**.
- Ethereum/ERCs pinned-source dry run: **2,611 functions, 578 events**.
- Combined: **3,787 distinct signatures** across the two snapshots
  (after source-level/cross-source deduplication).
- Current **live Arkiv coverage: exactly one function, zero events**.
  This is a proven minimal public mirror, not a fully populated catalogue.
- Current real proof:
  `getRoleMember(bytes32,uint256)` at `0x9010d07c`.

Full provenance, rejection counts and source licensing:
[`docs/reports/dataset-assessment.md`](../docs/reports/dataset-assessment.md).

## Who could use our copy after Mumbai?

- A wallet-extension developer can query our mirror by selector and show
  the original source path and pinned commit.
- A code-review tool can compare its ABI signature against a source-auditable
  canonical row.
- A contract-deployment dashboard can attach dataset version/provenance
  to its transaction labels.
- An independent client can query the Arkiv entity with their own credentials,
  not ask ATLAS to grant database access.

## Try the public read now

```sh
curl -i https://atlas-api-ivory.vercel.app/v1/functions/0x9010d07c
```

We measure and report coverage honestly: unknown selectors return an empty
candidate list, never a synthesized signature. We have no usage analytics or
community adoption numbers yet.

## After Mumbai

Priorities: increase source coverage with approved/reconciled batches, implement
event writes, automate freshness/expiry tracking, and publish documentation so
third-party clients can query Arkiv directly. Each is future work until tested.
