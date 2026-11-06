# Testing ATLAS

From a fresh checkout with Node 24 and pnpm 11:

```sh
pnpm install --frozen-lockfile
pnpm lint
pnpm format:check
pnpm build
pnpm typecheck
pnpm test
node packages/cli/dist/bin.js --help
node scripts/production-smoke.mjs https://atlas-api-ivory.vercel.app
```

Build first to generate workspace runtime and declaration exports. The build is topological. The Vitest suite includes controlled adapter fixtures. It does not spend tokens, write Arkiv entities or upload to Bee. Production smoke covers the deployed baseline API. See the sponsor readiness matrix for live acceptance gates.

Local Chromium exercised all ten routes at widths of 1280, 768 and 390 pixels, including direct refresh. It also exercised the browser-to-fixture API status request and a rejected privacy-mode request with no direct fallback. To repeat, run the fixture API and Studio on separate ports, set the exact local Studio CORS origin, and check each route at those viewport widths.
