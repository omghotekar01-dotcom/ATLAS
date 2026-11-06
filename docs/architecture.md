# ATLAS Architecture

This note records the initial workspace boundaries from the PRD. It is an architectural constraint, not a claim that the listed components are implemented.

## Workspace map

- `apps/studio`: browser UI only; no signing keys or duplicated business logic.
- `packages/schemas`: shared types and runtime validation.
- `packages/core`: framework-independent domain use cases.
- `packages/arkiv`: Arkiv SDK integration and repository implementations.
- `packages/chain`: EVM RPC clients and transaction/log retrieval.
- `packages/sdk`: public typed client, initially backed by the API.
- `packages/cli`: command parsing and output formatting.
- `services/api`: HTTP boundary, validation, and calls into core.
- `importer`: source ingestion, normalization, validation, and writes.

## Dependency direction

`packages/schemas` owns shared primitive types, runtime validation, domain result contracts, and error mappings. These schemas are consumed by domain and boundary packages. Core must not depend on Next.js, Fastify, CLI frameworks, or Arkiv SDK details. The API, CLI, SDK, importer, Arkiv adapter, chain adapter, and Studio integrate around the shared contracts; implementation should not introduce circular dependencies.

## Signature record hashes

The current SHA-256 preimage for a function record consists of its normalized selector, signature, source, source ID, and source update timestamp (represented as `null` when absent). An event record preimage consists of its normalized topic0, signature, source, and source ID. Import timestamps and dataset versions are intentionally excluded so that the hash identifies source record content rather than an individual import run. Fields are serialized with sorted object keys before hashing.

## Current state

Only the local workspace foundation is being established. Domain contracts, application packages, and integrations will be added in their planned phases and verified against the PRD.
