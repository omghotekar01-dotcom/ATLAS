# Deploying ATLAS

The existing API is [atlas-api](https://atlas-api-ivory.vercel.app). Deploy API and Studio separately after the reviewed feature branch and exact-commit CI pass.

For Studio, create the `atlas-studio` Vercel project from `omghotekar01-dotcom/ATLAS` in the OMIO STUDIO team. Use root `apps/studio`, Vite, Node 24, install `pnpm install --frozen-lockfile`, build `pnpm --filter '@atlas/studio...' run build` and output `dist`. Add public `VITE_ATLAS_API_URL=https://atlas-api-ivory.vercel.app`. On the API project set `ATLAS_CORS_ORIGINS` to the exact HTTPS Studio origin and `ATLAS_CORS_DEV_ORIGINS=false`. See [Vercel deployment](vercel-deployment.md) for API setup. Add optional sponsor configuration using [.env.example](../.env.example). Keep write credentials on the operator's machine.

Confirm the release commit in each deployment, verify runtime logs, run production smoke and refresh all ten URLs on desktop and mobile. Verify sponsor connections independently.
