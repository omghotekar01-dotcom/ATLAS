# ATLAS — development takeover and recovery handoff

## Recovery baseline

- Main branch commit before ChatGPT takeover: `9ebb74cdd9bca9c69a57d047e777f06d3a2d1ae7`
- Fixed checkpoint: `checkpoint/pre-chatgpt-recovery-20261106`
- Work branch: `fix/vercel-api-production-recovery-20261106`
- Active, evolving checklist and evidence: [GitHub issue #1](https://github.com/omghotekar01-dotcom/ATLAS/issues/1)
- Commit attribution rule: `Om Ghotekar <omghotekar01@gmail.com>`

Never force-push the checkpoint or `main`. Keep `.env`, wallet private keys, credentials, checkpoints and snapshots out of Git and Vercel. Production API is read-only.

## Current, verified product scope

- ATLAS provides function/event signature lookup, decoding, transaction investigation, SDK, CLI and seven-page Studio.
- The importer wrote **one** OpenZeppelin function signature to Arkiv Rabdi testnet (chain 7794095), and read it back successfully. That is _not_ a full dataset import.
- Reference function: `getRoleMember(bytes32,uint256)`, selector `0x9010d07c`.
- Reference entity key: `0x99f6593a55a1ae91590399a059adad2cfb8faa4cf69471d7f23a053ba407a034`.
- On-chain transaction: `0x0ddf2304bc90eacf5430c0d253cf8560f7b3dbbbf62f58f77c7b8a7347623594`.

## Production deployment situation — unresolved until live proof

- GitHub repository: `omghotekar01-dotcom/ATLAS` (private).
- Vercel account/team is **OMIO STUDIO**, project `atlas-api`.
- Domain previously tested: `https://atlas-api-ivory.vercel.app`.
- Earlier deployment logs indicated an invalid default export of `src/app.js`. GitHub now has `src/app-factory.ts` and `src/public-api.ts`, with `src/server.ts` the recognized native Fastify entry point. Never assume the logged failure belongs to the latest GitHub commit without checking the deployed SHA and unique deployment URL.
- The connected Vercel integration currently lacks authorized access to OMIO STUDIO; GitHub access works. Do not claim a Vercel deployment, domain promotion, or runtime inspection that was not verified.

## Automated testing

GitHub Actions CI runs formatting, lint, typechecking, tests and workspace builds on pull requests and `main`. No real Arkiv writes are performed.

After confirming an actual deployment and domain, run the real, **read-only** smoke test:

```powershell
node scripts/production-smoke.mjs https://atlas-api-ivory.vercel.app
```

Passing means all four requests returned the expected JSON, real Arkiv connectivity, canonical signature/entity, a search hit and an empty unknown selector. The smoke script never inserts data or signs transactions. It is not a substitute for reviewing Vercel logs and confirming the deployment SHA.

## Release procedure

1. Work on a dedicated `fix/` or `feat/` branch.
2. Run CI and review the diff for secrets and accurate attribution.
3. Review the branch/PR; merge only validated code.
4. Identify the **new** Vercel deployment by commit SHA and unique deployment URL.
5. Test the unique URL first. If healthy, verify/promote the production domain; then test it again.
6. Update issue #1 with exact results and unresolved problems.
7. Deploy and verify Studio afterward, including all ten routes and the final exact CORS origin.
