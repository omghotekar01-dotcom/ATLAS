/**
 * Pinned, licence-verified sources for derived function and event signatures.
 *
 * ATLAS does not use Sourcify-derived data (PRD QG-03). Each source below is a
 * first-party Solidity repository pinned to an exact commit; a signature record
 * can therefore be attributed to the commit, file path, declaration line and
 * licence that produced it. Only the sources listed here are accepted.
 *
 * `licenseFileSha256` is the SHA-256 of the licence file at the pinned commit.
 * `fetch.ts` verifies it before a snapshot is accepted, so a source cannot
 * silently change licence text without failing the import.
 */

export interface ExtractionSource {
  /** Stable identifier used on the command line. */
  readonly id: string;
  /** GitHub `owner/repository` slug. */
  readonly repo: string;
  /** HTTPS clone URL used by the snapshot fetcher. */
  readonly repositoryUrl: string;
  /** Full 40-hex commit SHA. Every record's source ID includes this value. */
  readonly commitSha: string;
  /** Committer date of the pinned commit (`YYYY-MM-DD`), verified via GitHub. */
  readonly commitDate: string;
  /** SPDX licence identifier verified in the repository at the pinned commit. */
  readonly license: string;
  /** Public licence URL at the pinned commit. */
  readonly licenseUrl: string;
  /** Licence file path relative to the repository root. */
  readonly licenseFile: string;
  /** SHA-256 of the licence file at the pinned commit. */
  readonly licenseFileSha256: string;
  /** Directory to scan inside the repository root; omitted means the root. */
  readonly sourceRoot?: string;
  /** Public URL of the pinned tree, used as the import manifest endpoint. */
  readonly treeUrl: string;
}

export const OPENZEPPELIN_SOURCE: ExtractionSource = {
  id: "openzeppelin-contracts",
  repo: "OpenZeppelin/openzeppelin-contracts",
  repositoryUrl: "https://github.com/OpenZeppelin/openzeppelin-contracts.git",
  commitSha: "efaa6f78ab1dde05416246e801c0baaf4f900d49",
  commitDate: "2026-11-02",
  license: "MIT",
  licenseUrl:
    "https://github.com/OpenZeppelin/openzeppelin-contracts/blob/efaa6f78ab1dde05416246e801c0baaf4f900d49/LICENSE",
  licenseFile: "LICENSE",
  licenseFileSha256: "0x20aebc68b11c063133aa2af0ef4bb29875477c6d16d715718f0daec563938b84",
  sourceRoot: "contracts",
  treeUrl:
    "https://github.com/OpenZeppelin/openzeppelin-contracts/tree/efaa6f78ab1dde05416246e801c0baaf4f900d49",
};

export const ETHEREUM_ERCS_SOURCE: ExtractionSource = {
  id: "ethereum-ercs",
  repo: "ethereum/ERCs",
  repositoryUrl: "https://github.com/ethereum/ERCs.git",
  commitSha: "7dafd1125fffbd3832316edeb739608ad82bb4c4",
  commitDate: "2026-11-04",
  license: "CC0-1.0",
  licenseUrl:
    "https://github.com/ethereum/ERCs/blob/7dafd1125fffbd3832316edeb739608ad82bb4c4/LICENSE.md",
  licenseFile: "LICENSE.md",
  licenseFileSha256: "0xa2010f343487d3f7618affe54f789f5487602331c0a8d03f49e9a7c547cf0499",
  sourceRoot: "assets",
  treeUrl: "https://github.com/ethereum/ERCs/tree/7dafd1125fffbd3832316edeb739608ad82bb4c4",
};

export const SOURCES: readonly ExtractionSource[] = [OPENZEPPELIN_SOURCE, ETHEREUM_ERCS_SOURCE];

export function getSource(id: string): ExtractionSource {
  const source = SOURCES.find((candidate) => candidate.id === id);
  if (!source) {
    throw new Error(
      `Unknown source "${id}". Supported sources: ${SOURCES.map((entry) => entry.id).join(", ")}.`,
    );
  }
  return source;
}

/** Rejects a source definition that could not produce auditable records. */
export function assertValidSource(source: ExtractionSource): void {
  if (!/^[a-f0-9]{40}$/.test(source.commitSha)) {
    throw new Error(
      `Source ${source.id} must pin a full 40-hex commit, received "${source.commitSha}".`,
    );
  }
  if (!/^0x[a-f0-9]{64}$/.test(source.licenseFileSha256)) {
    throw new Error(`Source ${source.id} must pin a SHA-256 licence file hash.`);
  }
  if (!/^[A-Za-z0-9.+-]+$/.test(source.license)) {
    throw new Error(`Source ${source.id} must declare an SPDX licence identifier.`);
  }
  if (!/^https:\/\/github\.com\/[^/]+\/[^/]+\.git$/.test(source.repositoryUrl)) {
    throw new Error(`Source ${source.id} must use an HTTPS GitHub clone URL.`);
  }
}
