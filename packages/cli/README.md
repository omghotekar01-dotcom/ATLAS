# `@atlas/cli`

Command-line client for the ATLAS REST API. Human-readable output by default,
machine-readable JSON with `--json`. The CLI never writes to Arkiv.

This package is not published to npm. Build it from the workspace.

## Build and run

```sh
pnpm install --frozen-lockfile
pnpm build
node packages/cli/dist/bin.js --help
```

Optionally link it locally:

```sh
pnpm --filter @atlas/cli link --global
atlas --help
```

## Configuration

| Flag / variable   | Meaning                                        |
| ----------------- | ---------------------------------------------- |
| `--api-url <url>` | API base URL                                   |
| `ATLAS_API_URL`   | Default API base URL (`http://localhost:3000`) |
| `--timeout <ms>`  | Request timeout (default `15000`)              |

`ARKIV_ACCESS_KEY` and `ATLAS_RPC_URL_*` belong to the API process, not the CLI.

## Commands

```sh
atlas doctor                                   # API + Arkiv health, read-only
atlas lookup 0xa9059cbb                        # every candidate for a selector
atlas lookup 0xa9059cbb --json
atlas search transfer --limit 10               # paginated signature scan
atlas search transfer --limit 10 --cursor ...  # next page
atlas decode 0xa9059cbb0000...                 # calldata against candidates
atlas event 0xddf252ad...                      # event topic0 lookup
atlas logs --file logs.json                    # [{ "topics": [...], "data": "0x..." }]
atlas tx 0x... --chain 1                       # verified RPC facts + decoding
```

`atlas tx` accepts only chains with a configured RPC endpoint: `1` (Mainnet)
and `11155111` (Sepolia). Other chains return `NOT_FOUND`.

## Output and exit codes

Human output is stable enough to read but not to parse; use `--json`. JSON is a
single document on stdout. Errors go to stderr.

| Exit | Meaning                                           |
| ---- | ------------------------------------------------- |
| `0`  | Success, including a valid empty lookup           |
| `2`  | Invalid usage or invalid input                    |
| `3`  | Not found (unknown chain, missing transaction)    |
| `4`  | Ambiguous candidates or decoding failed           |
| `1`  | Network, upstream, rate-limit or internal failure |

## Develop

```sh
pnpm --filter @atlas/cli typecheck
pnpm --filter @atlas/cli test
```
