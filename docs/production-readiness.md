# Production readiness audit

**Assessment date:** 2026-11-06  
**Scope:** Local preparation only. No Git repository was initialized, and no
Vercel project or deployment was created.

## Readiness summary

| Area            | Finding                                                                                                                                                                       |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Live data       | One Rabdi function-signature record is verified end-to-end. Coverage must not be described as a full dataset import.                                                          |
| Studio          | Vite/React build and seven TanStack Router routes pass; production preview returned HTTP 200 on all seven direct routes. A 560.83 kB main-chunk warning remains non-blocking. |
| API runtime     | Fastify is adapted to a Vercel Node Function without calling `listen`; the handler awaits the response and supports warm-instance reuse.                                      |
| API data source | The API uses real Arkiv adapters only. Missing Arkiv configuration reports unavailable/degraded; it does not switch to fixtures.                                              |
| Secrets         | `ARKIV_PRIVATE_KEY` is importer-only and must not be configured on Vercel. API errors are sanitized.                                                                          |
| Hosting         | Separate Vercel configs are prepared for `apps/studio` and `services/api`. Deployment remains blocked pending repository, domains, and server-side Arkiv read configuration.  |

## Runtime and routing

Vercel's Fastify framework preset detects `services/api/src/server.ts` and
serves the Fastify application as one function. The API has no path rewrites or
separate `api/` catch-all function, so `/health` and `/v1/*` reach Fastify with
their original request paths. The Studio's Vite output rewrites unknown paths
to `index.html` so each of the seven client routes can be opened or refreshed
directly.

The API Fastify function is configured for a 30-second maximum duration, above
the default upstream timeout of 8 seconds. Set both Vercel projects to Node.js
24.x; the repository pins Node 24 locally and its engine range excludes 25+.
The deployment guide contains the exact Root Directory, install/build command,
and project settings.

## Data behavior and health

- Function/event lookups read the Arkiv repositories configured by
  `ARKIV_ACCESS_KEY` and `ATLAS_ARKIV_CREATOR_ADDRESS`.
- No public API route invokes importer code or performs writes.
- Fixtures are used only by the explicit Studio sample-preview toggle or the
  dedicated local fixture harness; the production API does not import either.
- Empty lookup results, missing API configuration, network failures, and
  upstream errors have separate UI states.
- `GET /health` is a liveness response. It returns HTTP 200 with
  `status: "degraded"` when Arkiv is unavailable; production monitoring must
  check both the HTTP status and `arkiv.connected`.

The API rate limiter is an in-memory per-process limit. Vercel can run multiple
function instances, so this is not a global abuse-control boundary. For
meaningful public traffic, add an edge/WAF or shared rate-limit service before
relying on a hard aggregate quota.

## Local quality gates

The requested `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test`,
and `pnpm build` commands pass. The full test run reported 255 passing and 5
live-network tests skipped. The production Studio preview was checked at all
seven route URLs. The build warning above does not fail the build.

## Security review

- The API dependency factory reads `ARKIV_ACCESS_KEY` and the trusted creator
  address only; it does not construct an Arkiv signing client.
- Do not add `ARKIV_PRIVATE_KEY` to Vercel Project Environment Variables. Do
  not prefix any server-side credential with `VITE_`.
- `ATLAS_CORS_ORIGINS` must contain the exact production Studio origin. Set
  `ATLAS_CORS_DEV_ORIGINS=false`; wildcards are rejected.
- Internal API 4xx messages are not returned verbatim, unexpected errors use a
  generic response, and serverless failure logging excludes exception
  messages/stacks that could contain configuration values.
- `.gitignore` and `.vercelignore` exclude `.env`, local audit/checkpoint data,
  snapshots, caches, build outputs, and Vercel local project metadata. The
  workspace currently has no Git metadata, so a future repository must be
  reviewed before the first push.
- The local `.env` is under a OneDrive-synchronized workspace. `.gitignore`
  does not prevent OneDrive synchronization or backup. Move credentials out of
  this synced directory into an approved local secret store; rotate any key
  that may have been exposed through account sync or backup. This audit did not
  read or print `.env` values.

## Deployment blockers

1. The workspace is not a Git repository; create/connect the approved source
   repository and review the exact files before pushing.
2. Select the production Studio/API hostnames. The production Studio origin is
   required as an exact `ATLAS_CORS_ORIGINS` value.
3. Configure the production Arkiv read access key and trusted creator address
   as server-only API environment variables. Verify them with `/health` and
   the live selector read. Do not configure a private key.
4. Create the two Vercel projects with the settings in
   [`vercel-deployment.md`](./vercel-deployment.md), then review production
   environment values before the separately approved deployment.
5. After deployment, smoke-test the seven Studio routes, CORS allow/deny
   behavior, `/health`, and `/v1/functions/0x9010d07c`. These hosted checks
   cannot be completed locally.

## Go-live checks

- [ ] Repository review confirms `.env`, private keys, local checkpoints, and
      snapshots are not tracked or uploaded.
- [ ] Studio `VITE_ATLAS_API_URL` points to the production API origin.
- [ ] API has `ARKIV_ACCESS_KEY`, `ATLAS_ARKIV_CREATOR_ADDRESS`,
      `ATLAS_CORS_ORIGINS`, and `ATLAS_CORS_DEV_ORIGINS=false`.
- [ ] API has no `ARKIV_PRIVATE_KEY` or `ATLAS_WRITE_APPROVAL`.
- [ ] `GET /health` returns `status: "ok"` and `arkiv.connected: true`.
- [ ] The verified function selector returns the real entity with matching
      provenance; an unrelated selector returns an empty result.
- [ ] Direct refresh works for all ten routes; browser CORS accepts the exact
      Studio origin and rejects an unlisted origin.
