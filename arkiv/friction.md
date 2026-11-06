# Arkiv friction — honest builder feedback

Track: [Mirror something Ethereum depends on](https://ethglobal.com/events/mumbai/prizes).

## What worked

We connected to Rabdi chain `7794095` using
`@arkiv-network/sdk@1.0.1`; created one function-signature entity with an
explicit 180-day expiration; queried it by indexed selector; filtered by trusted
creator; and read back the exact content hash. The production Fastify API now
returns that real record. See
[`docs/arkiv-live-proof.md`](../docs/arkiv-live-proof.md) and
[the production smoke test](https://github.com/omghotekar01-dotcom/ATLAS/actions/runs/42230247461).

## Friction 1 — string attribute size is easy to miss

**Expected:** source signatures and provenance IDs to fit into normal
schema string fields.

**Observed:** the installed SDK imposes a 128-byte `str` field ceiling.
Canonical ABI signatures and source IDs can be longer.

**Workaround:** store signature text as `bytes()`; retain `selector`,
`source`, and `recordHash` as indexed `str()` fields. Verify with the
SDK types and [schema code](../packages/arkiv/src/schema.ts).

**Suggestion:** document `str` size limits next to schema examples and provide
a first-class indexed prefix or compact-text pattern.

## Friction 2 — bounded queries require explicit pagination

**Expected:** safe retrieval of an arbitrary number of records through one
high-level query.

**Observed:** the SDK's tested `MAX_LIMIT` is `100`. Dataset-wide search is
not the same as indexed selector filtering.

**Workaround:** deterministic order by `$key`, `gt("$key", key(lastKey))`,
pages of 100, and a stalled-cursor guard. See
[`repository.ts`](../packages/arkiv/src/repository.ts).

**Suggestion:** add a reference keyset-pagination helper, with an example for
resuming after a service restart and verifying a stable result set.

## Friction 3 — content identity and retry safety

**Expected:** importer retries should be safe even after uncertain RPC
outcomes.

**Observed:** on-chain entity creation is irreversible within our importer
model; blindly repeating a timed-out write could duplicate public records.

**Workaround:** immutable content-based `recordHash`, indexed
`findByRecordHash`, checkpointed progress, never blind retry, and immediate
read-back. See [`importer/src/write.ts`](../importer/src/write.ts).

**Suggestion:** document a recommended write/reconciliation protocol for
uncertain transaction receipts and an SDK example of idempotent ingestion.

## Environment-specific incident (not an Arkiv SDK bug)

Our **Vercel Fastify server startup** initially returned
`INTERNAL_FUNCTION_INVOCATION_FAILED`. The cause was the web framework
entry-point export, not Arkiv itself. The fix exported the ready Node HTTP
server. Do not attribute this to Arkiv.

## What is not yet known

We have **not** benchmarked multi-thousand-record Arkiv queries, throughput,
reliability, cross-source collision frequency on-chain, or expiry/renewal.
Additional feedback must be measured before being claimed.
