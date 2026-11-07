# ATLAS CLI

Command-line client for the ATLAS REST API. Human-readable output by default,
machine-readable JSON with `--json`. The CLI never writes to Arkiv.

## Quick start

**Published release (works today):**

```sh
# One-time global installation
npm i -g @omghotekar/atlas-cli

# Short commands after installation
atlas lookup 0x9010d07c
atlas doctor

# No global installation required
npx -y @omghotekar/atlas-cli lookup 0x9010d07c
```

The no-install invocation relies on the package exposing a single executable named `atlas`.
Node.js 22.18+ and a reachable ATLAS API are required. Existing commands remain available.

**Next release (0.1.1, source implemented; publish after smoke verification):**

```sh
atlas try
atlas try --json
```

`atlas try` requests the actual Arkiv lookup for selector `0x9010d07c` and
requires the matching source-attributed OpenZeppelin entity to be present.
It fails with a nonzero exit code if the API is offline or the record is missing.
Do not describe `atlas try` as available on npm until 0.1.1 is published.

## Release packaging

## Install the release archive

Requires Node.js 22.18 or newer. The public distribution name is
`@omghotekar/atlas-cli` and the executable is `atlas`. Build the archive
below or download the release archive, then install it from any directory:

```sh
npm install -g ./omghotekar-atlas-cli-0.1.1.tgz
atlas --version
atlas --timeout 45000 lookup 0x9010d07c --json
```

The archive bundles the ATLAS SDK and schema code and defaults to the public
ATLAS API. `--api-url` overrides `ATLAS_API_URL`, which overrides the default.
Sponsor commands require an API deployment with those endpoints and services
configured.

## Package from source

```sh
pnpm install --frozen-lockfile
pnpm --filter '@atlas/cli...' build
pnpm --filter @atlas/cli pack:npm --smoke
```

The archive is written to `.cache/npm/`. The smoke test installs it with npm
in an isolated temporary project and checks the executable and sponsor help.

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

| Flag / variable   | Meaning                                         |
| ----------------- | ----------------------------------------------- |
| `--api-url <url>` | API base URL                                    |
| `ATLAS_API_URL`   | API URL override for npm or workspace execution |
| `--timeout <ms>`  | Request timeout (default `15000`)               |

`ARKIV_ACCESS_KEY` and `ATLAS_RPC_URL_*` belong to the API process, not the CLI.

## Commands

```sh
atlas try                                      # Verified live Arkiv demo (0.1.1+)
atlas doctor                                   # API + Arkiv health, read-only
atlas integrations --json                      # configured sponsor status
atlas lookup 0xa9059cbb                        # every candidate for a selector
atlas lookup 0xa9059cbb --json
atlas search transfer --limit 10               # paginated signature scan
atlas search transfer --limit 10 --cursor ...  # next page
atlas decode 0xa9059cbb0000...                 # calldata against candidates
atlas event 0xddf252ad...                      # event topic0 lookup
atlas logs --file logs.json                    # [{ "topics": [...], "data": "0x..." }]
atlas tx 0x... --chain 1                       # verified RPC facts + decoding
atlas artifact <swarm-reference> --json        # bounded read from configured Bee API
atlas ens-role <account> --name <name.eth>      # ENSv2 name-scoped role evidence
atlas explain <calldata> --json                # configured 0G inference
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
