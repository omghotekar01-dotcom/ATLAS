# ATLAS Studio

The Studio UI is a local integration of the public Lovable export at [atlas-developer-studio](https://github.com/ompatil279/atlas-developer-studio). It retains the seven-screen navigation, restrained dark theme, command palette, sample-preview mode, and truthful unavailable/backend states.

The UI API client and sample fixtures were adapted to consume the shared schemas from `packages/schemas`. Sample results are opt-in, labeled as not live, and disabled by default. Events and transaction tracing remain unavailable until their corresponding backend integrations are implemented.

## Run locally

From the workspace root:

```sh
pnpm install
pnpm dev
```

By default, the Studio reports that the backend is unconfigured and makes no API requests. To connect a local API, copy `.env.example` to `.env.local` and set `VITE_ATLAS_API_URL` to its local base URL. Do not put credentials or secrets in a `VITE_` variable; Vite exposes those values to browser code.

## Checks

```sh
pnpm --filter @atlas/studio test
pnpm --filter @atlas/studio build
```

The frontend validates API responses with `@atlas/schemas`. Supported calls use the PRD contracts for `GET /v1/functions/:selector`, `GET /v1/functions/search`, `POST /v1/decode/calldata`, and `GET /health`. An HTTP error is not silently treated as a successful empty result.

## Production deployment

Deploy `apps/studio` as a **separate Vercel project** using `vite`,
Root Directory `apps/studio`, build command
`pnpm --filter '@atlas/studio...' run build`, output directory `dist`,
Node.js 24.x and **Include source files outside Root Directory** enabled.
Set the public `VITE_ATLAS_API_URL=https://atlas-api-ivory.vercel.app` for
Production and Preview. This contains **no secret**.

After Vercel allocates the Studio domain, set API `ATLAS_CORS_ORIGINS` to the
exact Studio HTTPS origin; set `ATLAS_CORS_DEV_ORIGINS=false` for production.
Redeploy the API if required for environment changes, and verify actual
browser requests, not just a Vite shell response.

The site has ten routes: `/`, `/explorer`, `/decode`, `/events`,
`/transactions`, `/docs`, `/status`, `/developers`, `/integrations`, and `/settings`. Direct refresh of each route must work.
