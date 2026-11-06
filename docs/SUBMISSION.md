# ATLAS — ETHGlobal Mumbai submission package

**Proposed prize:** Arkiv — **Mirror something Ethereum depends on**.
Official requirements: https://ethglobal.com/events/mumbai/prizes

## 30-second pitch

ATLAS mirrors provenance-verified Ethereum function signatures from pinned,
legally redistributable Solidity sources to Arkiv Rabdi. Developers search an
opaque 4-byte selector and receive a canonical ABI signature alongside
the original Git commit, source path, deterministic record hash and wallet-
attributed Arkiv entity key. ATLAS also provides decoding and investigation
tools, a typed SDK, a CLI and an iOS-inspired seven-page Studio.

## Verifiable facts

- Source repo: https://github.com/omghotekar01-dotcom/ATLAS
- Backend: https://atlas-api-ivory.vercel.app
- Health: https://atlas-api-ivory.vercel.app/health
- Canonical lookup:
  https://atlas-api-ivory.vercel.app/v1/functions/0x9010d07c
- Arkiv Rabdi chain ID: `7794095`.
- Writer wallet: `0xAd797f58aFD3265C00504382171eC0818262D3ca`.
- On-chain transaction:
  https://rabdi.explorer.arkiv.network/tx/0x0ddf2304bc90eacf5430c0d253cf8560f7b3dbbbf62f58f77c7b8a7347623594
- Entity key:
  `0x99f6593a55a1ae91590399a059adad2cfb8faa4cf69471d7f23a053ba407a034`.
- Verified online: **one function entity** written and read back. The 3,787
  distinct extracted signatures are offline source analyses, **not on-chain
  imported data**.
- Cloud acceptance:
  https://github.com/omghotekar01-dotcom/ATLAS/actions/runs/42230247461

## Prize criterion files (read in this order)

1. [`arkiv/schema.md`](../arkiv/schema.md) — fields, indexed filters, owner,
   trusted creator and expiry.
2. [`arkiv/friction.md`](../arkiv/friction.md) — reproducible SDK/product
   friction and workarounds.
3. [`arkiv/reach.md`](../arkiv/reach.md) — use cases, audience and honest
   coverage/adoption status.
4. [`arkiv/why-arkiv.md`](../arkiv/why-arkiv.md) — what Arkiv makes possible
   beyond a private Postgres catalogue.
5. [`arkiv/data-quality.md`](../arkiv/data-quality.md) — source licensing,
   extraction, checks, current data coverage and freshness.

## Installation / reproducibility

```sh
corepack enable
pnpm install --frozen-lockfile
pnpm build
node scripts/production-smoke.mjs https://atlas-api-ivory.vercel.app
# Safe, local-only importer dry run; no blockchain write:
node importer/dist/cli.js dry-run --source openzeppelin-contracts --fetch --json
```

Full importer docs: [`importer/README.md`](../importer/README.md).
Do not run `import --confirm-write` without a separately approved write plan.

## Missing gates before pressing Submit

- [ ] GitHub repo made **public** after a security review (currently private).
- [x] Root open-source [MIT license](../LICENSE) included in source.
- [x] Wallet and reproducible query documented.
- [x] Required Arkiv rubric files created.
- [x] SDK integration and one real Rabdi write/read-back proven.
- [ ] Studio deployed and all seven routes/browser API calls tested.
- [ ] Live dataset coverage expanded with separately approved writes
      (strongly recommended, **not a qualification requirement for one record**).
- [ ] Event-write path tested and event entities imported (recommended).
- [ ] Demo video recorded; demo link added here and to the event dashboard.
- [ ] Team members, AI-use statement, and accurate description submitted
      through the ETHGlobal Hacker Dashboard.
- [ ] ETHGlobal submission deadline and track eligibility rechecked in the
      dashboard. Avoid assuming a copied external time is definitive.

## Honest AI-use disclosure

ChatGPT and VS Code Copilot assisted with architecture discussions, code
generation/review, test-writing, documentation, CI, Vercel deployment debugging,
and sponsor research. Human team members directed the project, approved source
and credential decisions, and verified blockchain and deployed runtime
results. Code and data were reviewed through automated tests and live proof,
not represented as independently human-authored.

## Demo narration (two to three minutes)

See [`docs/DEMO_SCRIPT.md`](DEMO_SCRIPT.md). No demo-video file is claimed
to exist until it is actually recorded and hosted.
