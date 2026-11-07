import type { CliClient } from "./cli.js";

// Public proof references are inputs, never precomputed successful responses.
export const DEMO = {
  selector: "0x9010d07c",
  calldata: "0x9010d07c" + "0".repeat(128),
  swarm: "ac56bcf0360fe3d011060a8011b2ea1e3d71b7408c354075e05fa69f487ae386",
  swarmSha: "0x67ec935b13fac924b07c7e98013c88f62ad7118f77361e6b93cb6cdeded949e4",
  ensYes: "0xf633e7fc17e2bbe0d0965d18ec1821dcb754a3d3",
  ensNo: "0xAd797f58aFD3265C00504382171eC0818262D3ca",
} as const;

export type EvidenceState = "verified" | "unverified" | "unavailable" | "illustrative";
export type Evidence = { source: string; state: EvidenceState; message: string; data?: unknown };
export type Investigation = {
  input: string;
  selector: string;
  kind: "selector" | "calldata";
  checks: Evidence[];
  verified: number;
  warnings: string[];
};
export type InvestigationOptions = {
  full?: boolean;
  community?: boolean;
  zeroG?: "none" | "illustration" | "real";
};

export async function investigate(
  client: CliClient,
  inputRaw: string,
  opts: InvestigationOptions = {},
): Promise<Investigation> {
  const input = inputRaw.trim();
  if (!/^0x[0-9a-fA-F]{8}(?:[0-9a-fA-F]{64})*$/.test(input)) {
    throw new Error("Provide a 4-byte selector or ABI-aligned calldata (8 hex + 32-byte words).");
  }
  const selector = input.slice(0, 10).toLowerCase();
  const isCalldata = input.length > 10;
  const checks: Evidence[] = [];
  const canonical = await client.lookupFunction(selector);
  const candidates = canonical.candidates;
  const validCanonical =
    canonical.registry === "arkiv-rabdi" &&
    candidates.some((c) => Boolean(c.entityKey) && Boolean(c.provenance.recordHash));
  checks.push({
    source: "Arkiv Rabdi · canonical signatures",
    state: validCanonical ? "verified" : "unavailable",
    message: validCanonical
      ? candidates.map((c) => `${c.signature} · entity ${c.entityKey}`).join("; ")
      : "No provenance-backed Arkiv match. No fake database record was supplied.",
    data: canonical,
  });

  if (!validCanonical && opts.community !== false && client.lookupCommunity) {
    try {
      const hints = await client.lookupCommunity(selector);
      checks.push({
        source: "4byte.directory · unverified public suggestions",
        state: hints.candidates.length ? "unverified" : "unavailable",
        message: `${hints.candidates.length} community entries; NOT Arkiv imports or verified ABI.`,
        data: hints,
      });
    } catch (error) {
      checks.push({ source: "4byte.directory", state: "unavailable", message: String(error) });
    }
  }

  if (isCalldata) {
    try {
      const decoded = await client.decodeCalldata(input);
      const successes = decoded.decoded.filter((d) => d.decodeStatus === "success");
      checks.push({
        source: "ATLAS · deterministic calldata decoding",
        state: successes.length && validCanonical ? "verified" : "unavailable",
        message: successes.length
          ? `${successes.map((d) => d.signature).join(", ")}; ${successes.reduce((n, d) => n + d.arguments.length, 0)} argument(s).`
          : "The canonical registry cannot decode this calldata.",
        data: decoded,
      });
    } catch (error) {
      checks.push({
        source: "ATLAS calldata decoder",
        state: "unavailable",
        message: String(error),
      });
    }
  }

  if (opts.full) {
    if (client.getSwarmArtifact) {
      try {
        const a = await client.getSwarmArtifact(DEMO.swarm);
        const matches = a.reference === DEMO.swarm && a.sha256.toLowerCase() === DEMO.swarmSha;
        checks.push({
          source: "Swarm · actual manifest bytes and SHA-256",
          state: matches ? "verified" : "unavailable",
          message: matches
            ? `Digest matched: ${a.sha256}; size ${a.bytes} bytes.`
            : "Digest mismatch; no Swarm proof claimed.",
          data: { reference: a.reference, sha256: a.sha256, bytes: a.bytes },
        });
      } catch (e) {
        checks.push({ source: "Swarm", state: "unavailable", message: String(e) });
      }
    }
    for (const row of [
      { account: DEMO.ensYes, expectation: true, label: "ENSv2 EAC granted" },
      { account: DEMO.ensNo, expectation: false, label: "ENSv2 EAC denied" },
    ]) {
      if (!client.checkEnsV2Role) {
        checks.push({
          source: row.label,
          state: "unavailable",
          message: "ENSv2 adapter unavailable.",
        });
        continue;
      }
      try {
        const a = await client.checkEnsV2Role(row.account, { resource: "0", role: "1" });
        const ok =
          a.chainId === 11155111 &&
          a.resource === "0" &&
          a.requiredRoles === "1" &&
          a.authorized === row.expectation;
        checks.push({
          source: row.label,
          state: ok ? "verified" : "unavailable",
          message: ok
            ? `Actual authorized=${a.authorized} at Sepolia block ${a.blockNumber}.`
            : "Expected permission check did not match.",
          data: { account: a.account, authorized: a.authorized, blockNumber: a.blockNumber },
        });
      } catch (e) {
        checks.push({ source: row.label, state: "unavailable", message: String(e) });
      }
    }
  }

  if (opts.zeroG === "illustration") {
    checks.push({
      source: "0G-style local illustration (NOT a 0G request)",
      state: "illustrative",
      message: `Input ${selector} can identify a candidate function, but does not prove the deployed contract, execution or safety. Model: none. Request ID: none. 0G API calls: zero.`,
    });
  } else if (opts.zeroG === "real") {
    if (!isCalldata || !client.explainCalldata) {
      checks.push({
        source: "0G Private Computer",
        state: "unavailable",
        message: "Real inference requires canonical calldata and server credentials.",
      });
    } else {
      try {
        const a = await client.explainCalldata(input);
        const complete = a.provider === "0g-private-computer" && Boolean(a.requestId);
        checks.push({
          source: "0G Private Computer · real API inference",
          state: complete ? "verified" : "unverified",
          message: complete
            ? `Model ${a.model}; genuine provider request ID ${a.requestId}.`
            : "No provider request ID returned; do not claim 0G proof.",
          data: a,
        });
      } catch (e) {
        checks.push({ source: "0G Private Computer", state: "unavailable", message: String(e) });
      }
    }
  }

  if (opts.full) {
    checks.push({
      source: "Ethereum Foundation Anon-RPC · browser Nym worker",
      state: "unverified",
      message:
        "Real worker runs in Studio /integrations, not in this Node CLI. No Anon-RPC request was made by CLI; app-wide default anonymous routing is not implemented.",
    });
  }
  return {
    input,
    selector,
    kind: isCalldata ? "calldata" : "selector",
    checks,
    verified: checks.filter((c) => c.state === "verified").length,
    warnings: [
      "A matched selector is not proof of contract identity, ABI ownership, successful execution or safety.",
    ],
  };
}

export function formatInvestigation(report: Investigation): string {
  return [
    "ATLAS · Actual Ethereum interaction analysis",
    `Input: ${report.input}`,
    `Selector: ${report.selector} (${report.kind})`,
    ...report.checks.flatMap((c, i) => [
      "",
      `${i + 1}. [${c.state.toUpperCase()}] ${c.source}`,
      `   ${c.message}`,
    ]),
    "",
    `${report.verified} verified read(s).`,
    ...report.warnings,
  ].join("\n");
}
