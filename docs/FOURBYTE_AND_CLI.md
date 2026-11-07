# ATLAS community signature lookup (4byte.directory)

**Scope:** an opt-in, read-only community candidate lookup attached to the existing ATLAS canonical stack. No new Arkiv writes, GitHub publishing, deployment or payment are performed by this patch.

## Trust model

- `GET /v1/functions/:selector` is ATLAS canonical Arkiv data with pinned OpenZeppelin/ERC provenance.
- `GET /v1/community/4byte/:selector` fetches unverified candidates from 4byte.directory. The output includes `canonical:false`, warnings and truncated/collision flags.
- The community data is **not imported into Arkiv** and must never be presented as verified ABI, contract identity, proof of safety, or independent license/provenance clearance.
- 4byte.directory sources may contain Sourcify-derived rows. Arkiv Mirror forbids Sourcify data, so the mirror importer must continue using its separately qualified sources.
- The server uses a fixed HTTPS upstream host, validates an exact 4-byte selector, caps results, sanitizes errors, has a timeout, and inherits the API's request rate limit.

## Commands (Windows PowerShell from ATLAS repo root)

```powershell
corepack enable
corepack pnpm install --frozen-lockfile
corepack pnpm run typecheck
corepack pnpm run test
corepack pnpm run build
# Terminal A: API
corepack pnpm run api:dev
# Terminal B: CLI, read-only
node packages/cli/dist/bin.js doctor
node packages/cli/dist/bin.js lookup 0x9010d07c --json
node packages/cli/dist/bin.js 4byte 0xa9059cbb
node packages/cli/dist/bin.js 4byte 0xa9059cbb --json
# Terminal C: Studio
corepack pnpm run dev
```

The new `4byte` CLI command calls your ATLAS API (default http://localhost:3000); your API then reads 4byte.directory. `lookup` remains canonical Arkiv. For another deployed API, use `--api-url URL` before the subcommand or set `ATLAS_API_URL`.

## Public npm quickstart

```sh
npm i -g @omghotekar/atlas-cli
atlas lookup 0x9010d07c
# Or without installing:
npx -y @omghotekar/atlas-cli lookup 0x9010d07c
```

After the next 0.1.1 CLI release is published and verified, `atlas try`
will run the same real lookup and reject missing/unsupported source evidence.
Never advertise it as working on npm before that release.

## Demonstration sequence

1. Use `atlas doctor` to show the true Arkiv health state (not implied by 4byte connectivity).
2. Use `atlas lookup 0x9010d07c` for the single previously verified Arkiv record, subject to actual connectivity and imported wallet identity.
3. Use `atlas 4byte 0xa9059cbb` to inspect unverified community candidates; no wallet or API secrets are required by this read-only route.
4. In Studio → Explorer, enter a valid selector and click **Compare with 4byte.directory**. The community results appear in a separate panel and are not merged into canonical Arkiv candidates.
5. Re-run `lint`, `format:check`, `typecheck`, `test`, `build`, plus browser smoke tests before a release.

## Git / approvals

The ATLAS PRD requires separate explicit approval for Git commits, pushes, deployments, and public data writes. This local patch does not grant or perform those operations. If authorized later, create a fresh feature branch, set repository-local author to `Om Ghotekar <omghotekar01@gmail.com>`, inspect the diff and commit, push only that branch, and open a PR. Never force-update `main`, store secrets, or claim real-network proof from tests.

## External references

- https://www.4byte.directory/docs/
- https://ethglobal.com/events/mumbai/prizes
- https://docs.arkiv.network/networks/rabdi/
