# `@atlas/sdk`

Typed TypeScript client for the ATLAS REST API. It performs no chain or Arkiv
access itself; every request goes to a running ATLAS API.

This package is not published to npm. Use it from this workspace (or link the
built `dist` output) until publishing is explicitly approved.

## Install and build

```sh
pnpm install --frozen-lockfile
pnpm --filter @atlas/sdk build
```

The build emits `dist/index.js` and `dist/index.d.ts`.

## Usage

```ts
import { AtlasClient, AtlasSdkError } from "@atlas/sdk";

const atlas = new AtlasClient({
  baseUrl: process.env.ATLAS_API_URL ?? "http://localhost:3000",
  timeoutMs: 15_000,
});

const health = await atlas.health();

const lookup = await atlas.lookupFunction("0xa9059cbb");
for (const candidate of lookup.candidates) {
  console.log(candidate.signature, candidate.provenance.sourceId);
}

const search = await atlas.searchFunctions("transfer", { limit: 20 });
const decoded = await atlas.decodeCalldata("0xa9059cbb0000...");
const event = await atlas.lookupEvent(`0x${"d".repeat(64)}`);
const logs = await atlas.decodeLogs([{ topics: [`0x${"d".repeat(64)}`], data: "0x" }]);
const investigation = await atlas.analyzeTransaction({ chainId: 1, hash: `0x${"a".repeat(64)}` });
```

## Options

| Option      | Default                 | Meaning                                 |
| ----------- | ----------------------- | --------------------------------------- |
| `baseUrl`   | `http://localhost:3000` | API origin, trailing slashes removed    |
| `timeoutMs` | `15000`                 | Per-request deadline via `AbortSignal`  |
| `fetch`     | global `fetch`          | Injectable for tests or custom runtimes |

## Results and errors

Responses are validated with the shared zod schemas from `@atlas/schemas`.
An unexpected payload becomes `AtlasSdkError` with code `INVALID_RESPONSE`; a
transport failure becomes `NETWORK_ERROR`. API failures keep their domain code
(`NOT_FOUND`, `AMBIGUOUS_RESULT`, `UPSTREAM_UNAVAILABLE`, …) plus `status`,
`requestId` and `details`.

`bigint` values are decimal strings, never JSON numbers. A selector with no
mirrored record returns an empty candidate list; it is not an exception.

```ts
try {
  await atlas.lookupFunction("0xdeadbeef");
} catch (error) {
  if (error instanceof AtlasSdkError) {
    console.error(error.code, error.message, error.requestId);
  }
}
```

## Develop

```sh
pnpm --filter @atlas/sdk typecheck
pnpm --filter @atlas/sdk test
```
