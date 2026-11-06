# Deploying ATLAS

## Reuse the existing Vercel project

`atlas-ethglobal.vercel.app` serves the `atlas-api` project. To host Studio on
that same URL, keep the existing Fastify project, root `services/api` and
environment settings. Its checked-in build command runs
`pnpm --filter @atlas/api run build:vercel`, which packages Studio with the API.
If the Vercel project has a dashboard build-command override, set it to that
same command. The combined build points Studio requests at their own origin.

Verify a branch preview first: open `/`, refresh `/developers`, and test
`/health` and `/v1/functions/0x9010d07c`. Confirm the browser loads JavaScript
assets and that the configured Arkiv read works. Promote the reviewed commit
after CI and these checks pass.

## Separate Studio project

The existing API is [atlas-api](https://atlas-api-ivory.vercel.app). Deploy API and Studio separately after the reviewed feature branch and exact-commit CI pass.

For Studio, create the `atlas-studio` Vercel project from `omghotekar01-dotcom/ATLAS` in the OMIO STUDIO team. Use root `apps/studio`, Vite, Node 24, install `pnpm install --frozen-lockfile`, build `pnpm --filter '@atlas/studio...' run build` and output `dist`. Add public `VITE_ATLAS_API_URL=https://atlas-api-ivory.vercel.app`. On the API project set `ATLAS_CORS_ORIGINS` to the exact HTTPS Studio origin and `ATLAS_CORS_DEV_ORIGINS=false`. See [Vercel deployment](vercel-deployment.md) for API setup. Add optional sponsor configuration using [.env.example](../.env.example). Keep write credentials on the operator's machine.

Confirm the release commit in each deployment, verify runtime logs, run production smoke and refresh all ten URLs on desktop and mobile. Verify sponsor connections independently.
