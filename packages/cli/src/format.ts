import type {
  CalldataDecodeResult,
  CommunityLookupResult,
  EventLookupResult,
  FunctionLookupResult,
  FunctionSearchResult,
  HealthResponse,
  LogDecodeResult,
  TransactionInvestigation,
} from "@atlas/schemas";

function candidateLines(
  label: string,
  candidates: readonly { signature: string; source: string; sourceId: string }[],
): string[] {
  if (candidates.length === 0) return [`${label}: no canonical candidates`];
  return [
    `${label}: ${candidates.length} candidate${candidates.length === 1 ? "" : "s"}`,
    ...candidates.map(
      (candidate) =>
        `  - ${candidate.signature}\n    source: ${candidate.source}\n    record: ${candidate.sourceId}`,
    ),
  ];
}

function warningLines(warnings: readonly string[]): string[] {
  return warnings.length === 0 ? [] : ["Warnings:", ...warnings.map((warning) => `  - ${warning}`)];
}

export function formatLookup(result: FunctionLookupResult): string {
  return [
    `Function selector ${result.identifier}`,
    `Registry: ${result.registry}`,
    ...candidateLines("Signatures", result.candidates),
    ...warningLines(result.warnings),
  ].join("\n");
}

export function formatCommunity(result: CommunityLookupResult): string {
  return [
    `4byte.directory UNVERIFIED community suggestions for ${result.selector}`,
    `Candidates: ${result.candidates.length} (upstream count: ${result.total})`,
    ...result.candidates.map(
      (candidate) => `  - ${candidate.signature}  (community id ${candidate.id})`,
    ),
    ...(result.truncated ? ["Additional candidates may exist; output was limited."] : []),
    ...warningLines(result.warnings),
  ].join("\n");
}

export function formatEvent(result: EventLookupResult): string {
  return [
    `Event topic0 ${result.identifier}`,
    `Registry: ${result.registry}`,
    ...candidateLines("Signatures", result.candidates),
    ...warningLines(result.warnings),
  ].join("\n");
}

export function formatSearch(result: FunctionSearchResult, query: string): string {
  const lines = [
    `Search "${query}": ${result.items.length} result${result.items.length === 1 ? "" : "s"}`,
  ];
  for (const item of result.items) {
    lines.push(`  - ${item.signature}  ${item.selector}  (${item.source})`);
  }
  if (result.pagination.nextCursor) {
    lines.push(`Next cursor: ${result.pagination.nextCursor}`);
  }
  return lines.join("\n");
}

export function formatDecode(result: CalldataDecodeResult): string {
  const lines = [`Calldata selector ${result.selector}`];
  if (result.decoded.length === 0) {
    lines.push("No canonical signature is mirrored for this selector; ATLAS cannot decode it.");
  }
  for (const attempt of result.decoded) {
    if (attempt.decodeStatus === "success") {
      lines.push(`✓ ${attempt.signature}`);
      for (const argument of attempt.arguments) {
        lines.push(`    ${argument.name} (${argument.type}): ${JSON.stringify(argument.value)}`);
      }
    } else {
      lines.push(`✗ ${attempt.signature}`);
      lines.push(`    ${attempt.error}`);
    }
  }
  lines.push(...warningLines(result.warnings));
  return lines.join("\n");
}

export function formatLogs(results: readonly LogDecodeResult[]): string {
  const lines: string[] = [];
  for (const [index, result] of results.entries()) {
    lines.push(`Log ${index}: ${result.topic0}`);
    if (result.decoded.length === 0) lines.push("  No canonical event signature is mirrored.");
    for (const attempt of result.decoded) {
      if (attempt.decodeStatus === "success") {
        lines.push(`  ✓ ${attempt.signature}`);
        for (const argument of attempt.arguments) {
          lines.push(
            `      ${argument.name} (${argument.type}): ${JSON.stringify(argument.value)}`,
          );
        }
      } else {
        lines.push(`  ✗ ${attempt.signature}: ${attempt.error}`);
      }
    }
    lines.push(...warningLines(result.warnings).map((line) => `  ${line}`));
  }
  return lines.join("\n");
}

export function formatTransaction(result: TransactionInvestigation): string {
  const lines = [
    `Transaction ${result.transaction.hash} on chain ${result.transaction.chainId} (source: RPC)`,
    `From: ${result.transaction.from}`,
    `To:   ${result.transaction.to ?? "(contract creation)"}`,
    `Block: ${result.transaction.blockNumber ?? "pending"}`,
    `Receipt: ${result.receipt?.status ?? "not available"}`,
    "",
    "Function  /v1 registry interpretation:",
    result.functionLookup
      ? formatLookup(result.functionLookup)
      : "  No canonical function lookup is available.",
  ];

  if (result.functionDecode) {
    lines.push("", "Decoded calldata:", formatDecode(result.functionDecode));
  }
  if (result.eventResults.length > 0) {
    lines.push("", "Decoded logs:", formatLogs(result.eventResults));
  }
  if (result.warnings.length > 0) {
    lines.push("", "Warnings:", ...result.warnings.map((warning) => `  - ${warning}`));
  }
  if (result.limitations.length > 0) {
    lines.push("", "Limitations:", ...result.limitations.map((limitation) => `  - ${limitation}`));
  }
  return lines.join("\n");
}

export function formatHealth(health: HealthResponse, apiUrl: string): string {
  return [
    `ATLAS API: ${apiUrl}`,
    `Status: ${health.status}`,
    `Version: ${health.version}`,
    `Arkiv Rabdi: ${health.arkiv?.connected ? "connected" : "not connected"}`,
  ].join("\n");
}
