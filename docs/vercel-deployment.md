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
for direct navigation and refresh on all ten routes: `/`, `/explorer`,
`/decode`, `/events`, `/transactions`, `/docs`, `/status`, `/developers`, `/integrations`, and `/settings`.

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
| Framework Preset  | Fastify                                   |
| Build Command     | `pnpm --filter '@atlas/api...' run build` |
| Output Directory  | Leave unset                               |
| Install Command   | `pnpm install --frozen-lockfile`          |
| Node.js           | `24.x`                                    |
| Function duration | Set in Project Settings → Functions       |

Vercel's native Fastify support detects
[`services/api/src/server.ts`](../services/api/src/server.ts) and serves the
Fastify application as one function. It routes requests directly to Fastify,
so `/health`, `/v1/functions/:selector`, `/v1/functions/search`, and all other
registered API routes keep their original paths and query strings. The
detected entry file must directly import the runtime `Fastify` constructor
from `fastify` and use it to create the app; an indirect import through a
factory module is not sufficient for Vercel's entry-point detector. ATLAS
passes that constructor into `createApp` as `fastifyFactory`, preserving the
same route registrations and behavior. The
[`services/api/vercel.json`](../services/api/vercel.json) explicitly selects
the Fastify framework and contains no `functions`, `rewrites`, or
`outputDirectory` setting. Do not add an `api/` catch-all function or API
rewrites, as these compete with the framework's application routing. If you
need to set a function duration, configure it under Vercel Project Settings →
Functions rather than matching `src/server.ts` in `vercel.json`.
Do not rename the source app factory or public package barrel to the Vercel
recognized basenames `app`, `index`, or `server`: Vercel can select them as
entry points instead of the listener. ATLAS keeps these as
`src/app-factory.ts` and `src/public-api.ts`; a regression test enforces that
`src/server.ts` is the only recognized entry point. The build also verifies
that the compiled package's import and type exports resolve. See
[Vercel's Fastify documentation](https://vercel.com/docs/frameworks/backend/fastify)
for the supported entrypoint rules.

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
curl -i "https://<api-origin>/v1/functions/search?q=transfer&limit=1"
```

Require HTTP 200, `/health` JSON with `status: "ok"` and
`arkiv.connected: true`, and the verified OpenZeppelin record with its
provenance. Confirm an unknown selector returns an empty result rather than a
sample. The selector and search responses must be ATLAS JSON (not a Vercel
platform 404 or invalid-export error); verify the query returns the expected
result. Check deployment runtime logs for entry-point or module-resolution
errors. Then load and refresh each Studio route directly, test the exact CORS
origin and an unlisted origin, and inspect the browser network panel for the
API URL. The live record proof and transaction details are in
[`arkiv-live-proof.md`](./arkiv-live-proof.md).

## Vercel Node server entry contract (2026-11-06)

The Vercel native Fastify adapter must load a **Node.js HTTP Server**, not a factory.
`services/api/src/server.ts` directly imports Fastify for framework discovery,
creates the application through `createApp`, awaits `app.ready()`, and
**exports `app.server` as the module default**. The real TCP `app.listen()`
call occurs **only outside** Vercel (`!process.env.VERCEL`). Never deploy a
Fastify factory without a compatible HTTP-server default export, and never
invoke a second listener in Vercel's managed runtime.

The tests `server.vercel.test.ts` and `vercel-config.test.ts` guard the
HTTP-server export, startup lifecycle, liveness response and routed lookup.
They do not establish that production Arkiv is reachable; that requires
separate HTTP 200 checks and a matching real entity from the deployed URL.

This fix was motivated by repeated production `500 INTERNAL_FUNCTION_INVOCATION_FAILED`
responses despite Vercel marking the build READY. A successful build is not
an acceptable substitute for real deployment verification.
