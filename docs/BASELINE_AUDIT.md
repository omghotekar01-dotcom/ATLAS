# ATLAS baseline audit

The public [ATLAS repository](https://github.com/omghotekar01-dotcom/ATLAS) was fetched at main commit `1a2b087580ecd39df0783150a4b6a4c9af3b8b47`. [Baseline GitHub CI](https://github.com/omghotekar01-dotcom/ATLAS/actions/runs/42261176854) passed. Work was isolated in `feat/atlas-final-sponsors-20261107`.

Node 24.22.1 and pnpm 11.25.0 installed the frozen baseline lockfile. Baseline lint and formatting passed. Running baseline typecheck, test and build immediately afterward exposed a clean-checkout build order defect: consumers could not resolve generated workspace exports. CI already prebuilt the dependency graph. The feature root build now builds workspace packages in dependency order before the full typecheck.

The production API smoke passed health, canonical function lookup, function search and unknown-selector handling. See [live Arkiv proof](arkiv-live-proof.md). This covers the production baseline.

The Arkiv event importer source and tests came from draft PR #7. Its CI publication workflow changes were excluded. The prepared five-sponsor kit contributed adapter source, which was integrated and revised in the isolated worktree. No signer, postage spend or billable inference was used.
