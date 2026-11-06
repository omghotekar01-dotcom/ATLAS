# Data provenance and quality

## Current status

One OpenZeppelin function signature has been written to Arkiv Rabdi and verified
by read-back and live API query. This does not mean the source dataset was
fully imported: only one live function record is confirmed. The
`ethereum-lists/4bytes` source remains blocked because its records cannot be
shown to exclude Sourcify data, as required by the PRD. Dry-run counts below are
source-analysis counts, not counts of live Arkiv records.

An offline importer now exists and has been verified against synthetic fixtures
(3 files, 12 declarations, 10 validated, 8 functions, 2 events, 2 duplicates, 3
rejections, 0 writes). Those counts describe the fixtures only, not a real source
snapshot.

## Evaluated source

The candidate source is
[ethereum-lists/4bytes](https://github.com/ethereum-lists/4bytes), pinned for
inspection at commit
[`2b8a705fe27833b59aac2a2af5d14e0144e1e56e`](https://github.com/ethereum-lists/4bytes/commit/2b8a705fe27833b59aac2a2af5d14e0144e1e56e).
The repository declares the MIT license; see its
[LICENSE file at the inspected commit](https://github.com/ethereum-lists/4bytes/blob/2b8a705fe27833b59aac2a2af5d14e0144e1e56e/LICENSE).

The upstream
[README at that commit](https://github.com/ethereum-lists/4bytes/blob/2b8a705fe27833b59aac2a2af5d14e0144e1e56e/README.md)
describes adding signatures after source-code verification through
Sourcify. The `signatures/<selector>` files expose signature text (including
semicolon-separated collisions), but no per-record provenance field that
would reliably identify and exclude Sourcify-derived entries. Therefore the
dataset cannot currently be used without violating the PRD's exclusion rule.
No Sourcify API, dataset, or record was queried or imported.

## Other sources evaluated

- [4byte.directory API documentation](https://www.4byte.directory/docs/)
  describes importing signatures from submitted Solidity/ABI data and
  GitHub webhooks. Its documented signature records expose an ID, text
  signature, selector, and creation time, but no source/provenance field;
  the documentation also does not state a dataset redistribution license.
  Public API availability is not sufficient evidence for either requirement.
- The [ethereum-function-signature-registry repository](https://github.com/pipermerriam/ethereum-function-signature-registry)
  identifies 4byte.directory as its current website and has no declared
  repository license, so it is not an independent, license-verified source.
- [Etherface](https://github.com/volsa/etherface) states in its README that
  its data was transferred to Sourcify. It is explicitly excluded.

## Derived-source approach (implemented, not yet run on a real snapshot)

To avoid Sourcify entirely, the importer derives signatures from first-party
Solidity source pinned to a commit:

- [OpenZeppelin Contracts](https://github.com/OpenZeppelin/openzeppelin-contracts)
  at commit `efaa6f78ab1dde05416246e801c0baaf4f900d49`; MIT licence.
- [ethereum/ERCs](https://github.com/ethereum/ERCs) at commit
  `7dafd1125fffbd3832316edeb739608ad82bb4c4`; CC0-1.0 licence.

Every derived record carries the repository, commit SHA, file path and exact
canonical signature in its source ID, so provenance is auditable at record level.
Declarations whose ABI types require compiler-level symbol resolution (structs,
enums, contract types, function/mapping types, constant array lengths) are
rejected rather than guessed. Event signatures are extracted but not written
until an approved event import populates the `atlas.event-signatures` schema.

The single confirmed live record is `getRoleMember(bytes32,uint256)` from
OpenZeppelin Contracts at the pinned commit above. Its transaction, entity key,
record hash, read-back and live API evidence are recorded in
[docs/arkiv-live-proof.md](arkiv-live-proof.md).

This approach is Sourcify-free and licence-verified, but it is a **derived**
function/event catalogue, not a mirror of the PRD's named `ethereum-lists/4bytes`
registry with upstream record IDs. Adopting it as the initial data source is a
product decision that should be reflected explicitly in the PRD and backlog.

## Next steps

- Choose and document the initial data source policy: continue the derived
  first-party-source approach or identify a registry snapshot with verifiable
  record-level provenance that excludes Sourcify.
- Do not infer total imported coverage from dry-run data: only the record in
  [docs/arkiv-live-proof.md](arkiv-live-proof.md) is verified live.
- Any follow-up import requires its own explicit approval and a fresh
  write-plan review; do not rerun an import as part of this evidence.
- Generate freshness and quality metrics only from an actual, auditable
  import and Arkiv read-back report.
