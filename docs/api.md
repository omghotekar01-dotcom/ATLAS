# ATLAS REST API

The API reads canonical function and event signatures from the mirrored Arkiv
dataset and, when an RPC endpoint is configured, verified transaction facts from
an EVM chain. It never signs, writes or publishes transactions.

## Run locally

```sh
pnpm build
ARKIV_ACCESS_KEY=... ATLAS_ARKIV_CREATOR_ADDRESS=0x... \
ATLAS_RPC_URL_1=https://... PORT=3000 \
node services/api/dist/server.js
```

`GET /health` always answers `200`. `status` is `ok` only when Arkiv is
reachable and configured; otherwise it is `degraded` with the reason.

## Endpoints

| Method | Path                       | Purpose                                  |
| ------ | -------------------------- | ---------------------------------------- |
| GET    | `/health`                  | Liveness and upstream status             |
| GET    | `/v1/functions/search`     | Search mirrored signatures               |
| GET    | `/v1/functions/:selector`  | Look up a 4-byte selector                |
| POST   | `/v1/decode/calldata`      | Decode calldata against candidates       |
| GET    | `/v1/events/:topic0`       | Look up an event topic0                  |
| POST   | `/v1/decode/logs`          | Decode up to 20 logs                     |
| POST   | `/v1/transactions/analyze` | RPC facts + decoding for one transaction |

### `GET /v1/functions/search?q=<text>&limit=<1-100>&cursor=<opaque>`

Arkiv indexes the selector and record hash, not the signature text, so this is a
documented paginated scan of the mirrored dataset. Results are ordered and
stable; pass the returned `nextCursor` to continue. Limits outside `1..100` and
queries outside `1..200` characters are `INVALID_REQUEST`.

### `GET /v1/functions/:selector`

Returns every candidate that shares the selector. `ambiguous` is true when more
than one distinct signature exists. Colliding candidates are never merged.

### `POST /v1/decode/calldata`

Body: `{ "calldata": "0x...", "strict": false }`. `strict` is accepted for contract compatibility; every candidate outcome is still returned. Each candidate is decoded
independently and re-encoded; a candidate only reports `success` when the bytes
round-trip exactly. `bigint` values are decimal strings.

### `GET /v1/events/:topic0`

Returns event-signature candidates for a 32-byte topic0 from the Arkiv
`atlas.event-signatures` schema. Unknown topics are a valid empty result, not an
error; an unconfigured or unreachable registry is `UPSTREAM_UNAVAILABLE`.

### `POST /v1/decode/logs`

Body: `{ "logs": [{ "topics": ["0x..."], "data": "0x..." }] }`, 1 to 20 logs.
If a mirrored event record has no pinned `indexed` layout, ATLAS tries the valid
layouts. Exactly one match is decoded; several matches return an explicit
"will not guess" failure. Topics and data must be valid hex.

### `POST /v1/transactions/analyze`

Body: `{ "chainId": 1, "hash": "0x..." }`. Only chains `1` (Mainnet) and
`11155111` (Sepolia) are accepted, and only when their RPC URL is configured.
The response separates:

- `transaction` and `receipt`: verified RPC facts;
- `functionLookup` / `functionDecode`: Arkiv candidates and per-candidate decode
  results;
- `eventResults`: per-log candidates;
- `warnings` and `limitations`: honest gaps (for example internal calls are not
  decoded, or the registry was unavailable).

A missing or pending transaction is `NOT_FOUND`; a reverted transaction is
reported as `receipt.status = "reverted"` with its verified facts. An RPC or
registry outage is `UPSTREAM_UNAVAILABLE`, never a fabricated success.

## Errors

All failures use the shared envelope:

```json
{
  "error": {
    "code": "INVALID_SELECTOR",
    "message": "…",
    "details": null,
    "requestId": "…"
  }
}
```

Codes come from `@atlas/schemas` (`INVALID_SELECTOR`, `INVALID_REQUEST`,
`NOT_FOUND`, `AMBIGUOUS`, `DECODE_FAILED`, `UPSTREAM_UNAVAILABLE`,
`RATE_LIMITED`, `INTERNAL`). `requestId` echoes `x-request-id` when supplied or
is generated. Request IDs are safe to log; credentials are not.

`/v1/*` is rate limited (`ATLAS_RATE_LIMIT_PER_MINUTE`, default 120) and returns
`429` with `retry-after`. Upstream calls time out after
`ATLAS_UPSTREAM_TIMEOUT_MS` (default 8000) and become `UPSTREAM_UNAVAILABLE`.

## Configuration

| Variable                      | Purpose                                       |
| ----------------------------- | --------------------------------------------- |
| `ARKIV_ACCESS_KEY`            | Rabdi read access                             |
| `ATLAS_ARKIV_CREATOR_ADDRESS` | Canonical creator whose records are trusted   |
| `ATLAS_RPC_URL_1`             | Ethereum Mainnet RPC                          |
| `ATLAS_RPC_URL_11155111`      | Sepolia RPC                                   |
| `PORT` / `HOST`               | Listen address (default `3000` / `127.0.0.1`) |
| `ATLAS_RATE_LIMIT_PER_MINUTE` | Per-client request budget                     |
| `ATLAS_UPSTREAM_TIMEOUT_MS`   | Upstream deadline                             |
| `ATLAS_CORS_ORIGINS`          | Extra allowed browser origins (comma list)    |
| `ATLAS_CORS_DEV_ORIGINS`      | `false` drops the localhost dev origins       |

## Browser access (CORS)

The API answers cross-origin browser calls only for an explicit allowlist of exact
origins. Dev origins allowed by default: `http://localhost:5173`, `http://127.0.0.1:5173`,
`http://localhost:4173`, `http://127.0.0.1:4173`. Add production origins with
`ATLAS_CORS_ORIGINS` (exact `scheme://host[:port]`, no paths or wildcards; invalid values
fail at startup). Wildcards and credentials are never sent. Preflight `OPTIONS` answers
with 204 and does not consume rate budget; 429 and error replies still carry the CORS
headers so the browser can show the real error.

The API never exposes `ARKIV_PRIVATE_KEY`; only the importer uses it, behind the
write approval gate.

Local runs read a root `.env` automatically (`pnpm api:dev` / `pnpm api:start`
pass `--env-file-if-exists=../../.env`); a missing file is not an error. Copy
`.env.example` to start one. Nothing is read at import time, so the Vercel
handler still takes its configuration from the platform environment.

## Vercel

Vercel's Fastify framework preset detects `services/api/src/server.ts` and
serves the Fastify application directly as a single function. API paths,
including `/health` and `/v1/*`, are handled without a routing prefix or
rewrite. Keep the API project's output directory unset and do not add a
separate `api/` function.
