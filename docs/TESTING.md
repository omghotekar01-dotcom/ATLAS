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
