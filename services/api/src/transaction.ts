import { decodeCalldata, decodeLog, lookupFunction } from "@atlas/core";
import {
  AtlasError,
  LogInputSchema,
  TransactionInvestigationSchema,
  type CalldataDecodeResult,
  type FunctionLookupResult,
  type LogDecodeResult,
  type TransactionInvestigation,
} from "@atlas/schemas";

import type { ApiDependencies } from "./deps.js";

const MAX_LOGS = 25;

const STATIC_LIMITATIONS = [
  "ATLAS reports only what the configured RPC endpoint returns; it does not verify consensus independently.",
  "Internal calls, token transfers and state diffs are not decoded.",
  "Function candidates come from the canonical Arkiv registry, not from a verified contract ABI for this address.",
];

function describe(error: unknown): string {
  return error instanceof Error ? error.message : "unknown error";
}

/**
 * Combines verified RPC facts with optional registry interpretations. RPC
 * failures abort; registry failures degrade with an explicit warning so the
 * on-chain facts are still reported honestly.
 */
export async function investigateTransaction(
  dependencies: ApiDependencies,
  chainId: number,
  hash: string,
): Promise<TransactionInvestigation> {
  const reader = dependencies.chains.get(chainId);
  const transaction = await reader.getTransaction(hash);

  const warnings: string[] = [];
  const limitations = [...STATIC_LIMITATIONS];
  const receipt = await reader.getReceipt(hash);

  if (receipt === null) {
    warnings.push(
      "No receipt is available yet; the transaction may be pending or this RPC may not have indexed it.",
    );
    limitations.push("Without a receipt, ATLAS cannot report execution status or emitted logs.");
  } else if (receipt.status === "reverted") {
    warnings.push(
      "Execution reverted: the transaction was mined but its state changes were rolled back.",
    );
  }

  const calldata = transaction.input && transaction.input.length >= 10 ? transaction.input : null;
  const looksLikeFunctionCall = calldata !== null && transaction.to !== null;

  let functionLookup: FunctionLookupResult | null = null;
  let functionDecode: CalldataDecodeResult | null = null;

  if (looksLikeFunctionCall && calldata) {
    try {
      functionLookup = await lookupFunction(dependencies.functions, calldata.slice(0, 10));
    } catch (error) {
      if (error instanceof AtlasError) {
        warnings.push(`Signature lookup is unavailable: ${error.message}`);
      } else {
        warnings.push("Signature lookup failed for an unexpected reason.");
      }
    }

    if (functionLookup) {
      try {
        functionDecode = await decodeCalldata(dependencies.functions, calldata);
      } catch (error) {
        warnings.push(`Calldata could not be decoded: ${describe(error)}`);
      }
    }
  } else if (transaction.to === null) {
    limitations.push(
      "This is a contract-creation transaction; there is no selector or calldata to match.",
    );
  } else {
    limitations.push("The transaction carries empty calldata, so there is no function to decode.");
  }

  const eventResults: LogDecodeResult[] = [];
  if (receipt) {
    const logs = receipt.logs.slice(0, MAX_LOGS);
    if (receipt.logs.length > logs.length) {
      warnings.push(
        `Only the first ${MAX_LOGS} of ${receipt.logs.length} logs were decoded to bound the response.`,
      );
    }

    for (const [index, log] of logs.entries()) {
      if (log.topics.length === 0) {
        warnings.push(`Log ${index} has no topics and cannot be decoded as an event.`);
        continue;
      }
      try {
        eventResults.push(
          await decodeLog(
            dependencies.events,
            LogInputSchema.parse({ topics: log.topics, data: log.data }),
          ),
        );
      } catch (error) {
        if (error instanceof AtlasError) {
          warnings.push(`Log ${index} event decoding is unavailable: ${error.message}`);
        } else {
          warnings.push(`Log ${index} could not be decoded.`);
        }
      }
    }
  }

  return TransactionInvestigationSchema.parse({
    transaction: {
      hash: transaction.hash,
      chainId: transaction.chainId,
      from: transaction.from,
      to: transaction.to,
      input: transaction.input,
      blockNumber: transaction.blockNumber,
      source: "rpc",
    },
    receipt: receipt ? { status: receipt.status, source: "rpc" } : null,
    functionLookup,
    functionDecode,
    eventResults,
    limitations,
    warnings,
  });
}
