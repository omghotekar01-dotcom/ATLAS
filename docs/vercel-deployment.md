# Vercel deployment guide

This guide prepares two separate Vercel projects from the ATLAS monorepo. It
does not authorize creating projects or deploying; each deployment remains a
separate approval gate.

## Shared repository settings

- Package manager: pnpm `11.25.0` from root `package.json`.
- Node.js: select **24.x** for builds and functions.
- Install command for both projects: `pnpm install --frozen-lockfile`.
- Enable **Include source files outside of the Root Directory in the Build
  Step**. Both apps depend on workspace packages and the root lockfile.
- Keep Vercel's default deployment protection and environment scoping unless
  a separate review approves a change.
- `.gitignore` and root `.vercelignore` exclude the local `.env`, `.audit`,
  `.cache`, importer snapshots, build artifacts, and `.vercel` project state.
  Keep the live `.env` out of OneDrive and never commit it.

## Project 1: `atlas-studio`

| Setting          | Value                                        |
| ---------------- | -------------------------------------------- |
| Root Directory   | `apps/studio`                                |
| Framework Preset | Vite                                         |
| Build Command    | `pnpm --filter '@atlas/studio...' run build` |
| Output Directory | `dist`                                       |
| Install Command  | `pnpm install --frozen-lockfile`             |
| Node.js          | `24.x`                                       |

[`apps/studio/vercel.json`](../apps/studio/vercel.json) contains those build
settings and the SPA fallback rewrite to `/index.html`. The fallback is needed
for direct navigation and refresh on all seven routes: `/`, `/explorer`,
`/decode`, `/events`, `/transactions`, `/docs`, and `/status`.

Add one **Production** environment variable:

| Name                 | Value                                                                  |
| -------------------- | ---------------------------------------------------------------------- |
| `VITE_ATLAS_API_URL` | The HTTPS origin of the production `atlas-api` project, without a path |

This variable is public and compiled into browser code. It must contain only
the API's public URL, never an access key or other credential. Set the same
value in Preview only if that Preview API is intentionally reachable.

## Project 2: `atlas-api`

| Setting           | Value                                     |
| ----------------- | ----------------------------------------- |
| Root Directory    | `services/api`                            |
| Framework Preset  | Other                                     |
| Build Command     | `pnpm --filter '@atlas/api...' run build` |
| Output Directory  | Leave unset                               |
| Install Command   | `pnpm install --frozen-lockfile`          |
| Node.js           | `24.x`                                    |
| Function duration | `30` seconds maximum                      |

[`services/api/api/[...path].ts`](../services/api/api/[...path].ts) is the function
entry point. It exports the Fastify adapter from source, which is covered by
`services/api/tsconfig.vercel.json`; do not use
`services/api/src/server.ts` as a Vercel function because that file calls
`listen()` and installs process signal handlers for a long-running server.
The serverless handler does not listen on a port. The entry is named
`api/[...path].ts` so it matches the configured Vercel catch-all function.
Rewrites map `/health` and `/v1/*` to `/api/...`; the adapter removes only the
`/api` routing prefix and retains the original path and query string for
Fastify. Vercel passes query parameters through these rewrites.

Set these **Production** environment variable names in the API project only:

| Name                          | Requirement                                                                                       |
| ----------------------------- | ------------------------------------------------------------------------------------------------- |
| `ARKIV_ACCESS_KEY`            | Required server-side credential for real Arkiv reads                                              |
| `ATLAS_ARKIV_CREATOR_ADDRESS` | Required trusted creator address used to filter canonical records                                 |
| `ATLAS_CORS_ORIGINS`          | One exact production Studio origin, for example `https://studio.example.com`; no wildcard or path |
| `ATLAS_CORS_DEV_ORIGINS`      | Set to `false` in production                                                                      |
| `ATLAS_RATE_LIMIT_PER_MINUTE` | Optional; default is `120` per function instance                                                  |
| `ATLAS_UPSTREAM_TIMEOUT_MS`   | Optional; default is `8000` milliseconds                                                          |
| `ATLAS_RPC_URL_1`             | Optional; enables Ethereum Mainnet transaction analysis                                           |
| `ATLAS_RPC_URL_11155111`      | Optional; enables Ethereum Sepolia transaction analysis                                           |

Do **not** create `ARKIV_PRIVATE_KEY`, `ATLAS_WRITE_APPROVAL`, or `VITE_*`
credential variables in Vercel. The API is read-only and has no import route.
The in-memory rate limiter is per instance, not a global quota.

For production, set `ATLAS_CORS_ORIGINS` to the final Studio origin exactly
(scheme, host, optional port; no trailing path), and turn off development
origins. If a separate Preview Studio should call the API, add its exact origin
only after deciding to allow it.

## Build and runtime verification before deployment

From the monorepo root, verify workspace package builds:

```sh
pnpm --filter '@atlas/studio...' run build
pnpm --filter '@atlas/api...' run build
```

Then configure the projects in the Vercel dashboard and review each Production
environment-variable name and scope. No project, domain, environment value, or
deployment is created by these local commands.

After an approved deployment, check:

```sh
curl -i https://<api-origin>/health
curl -i https://<api-origin>/v1/functions/0x9010d07c
```

Require HTTP 200, `/health` JSON with `status: "ok"` and
`arkiv.connected: true`, and the verified OpenZeppelin record with its
provenance. Confirm an unknown selector returns an empty result rather than a
sample. Then load and refresh each Studio route directly, test the exact CORS
origin and an unlisted origin, and inspect the browser network panel for the
API URL. The live record proof and transaction details are in
[`arkiv-live-proof.md`](./arkiv-live-proof.md).
