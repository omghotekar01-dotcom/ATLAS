import { readFile } from "node:fs/promises";
import { Command, CommanderError } from "commander";
import { AtlasSdkError, AtlasClient, type AtlasClientOptions } from "@atlas/sdk";
import {
  LogInputSchema,
  type CalldataDecodeResult,
  type EventLookupResult,
  type FunctionLookupResult,
  type FunctionSearchResult,
  type HealthResponse,
  type LogDecodeResult,
  type LogInput,
  type TransactionInvestigation,
} from "@atlas/schemas";

import {
  formatDecode,
  formatEvent,
  formatHealth,
  formatLogs,
  formatLookup,
  formatSearch,
  formatTransaction,
} from "./format.js";

export const CLI_VERSION = "0.1.0";

export interface CliClient {
  health(): Promise<HealthResponse>;
  lookupFunction(selector: string): Promise<FunctionLookupResult>;
  searchFunctions(
    query: string,
    options: { limit?: number; cursor?: string },
  ): Promise<FunctionSearchResult>;
  decodeCalldata(calldata: string): Promise<CalldataDecodeResult>;
  lookupEvent(topic0: string): Promise<EventLookupResult>;
  decodeLogs(logs: readonly LogInput[]): Promise<LogDecodeResult[]>;
  analyzeTransaction(input: { chainId: number; hash: string }): Promise<TransactionInvestigation>;
}

export interface RunOptions {
  client?: CliClient;
  stdout?: (line: string) => void;
  stderr?: (line: string) => void;
  env?: Readonly<Record<string, string | undefined>>;
}

export class UsageError extends Error {}

export function cliExitCode(code: AtlasSdkError["code"]): number {
  switch (code) {
    case "INVALID_INPUT":
    case "INVALID_SELECTOR":
    case "INVALID_TOPIC0":
      return 2;
    case "NOT_FOUND":
      return 3;
    case "AMBIGUOUS_RESULT":
    case "DECODE_FAILED":
      return 4;
    default:
      return 1;
  }
}

function parsePositiveInteger(value: string, label: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new UsageError(`${label} must be a positive integer.`);
  }
  return parsed;
}

function parseLimit(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 100) {
    throw new UsageError("--limit must be an integer from 1 to 100.");
  }
  return parsed;
}

async function readLogs(file: string): Promise<LogInput[]> {
  let text: string;
  try {
    text = await readFile(file, "utf8");
  } catch {
    throw new UsageError(`Could not read logs file "${file}".`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new UsageError(`Logs file "${file}" is not valid JSON.`);
  }

  const container = Array.isArray(parsed)
    ? { logs: parsed }
    : (parsed as { logs?: unknown } | null);
  const result = LogInputSchema.array().safeParse(container?.logs);
  if (!result.success) {
    throw new UsageError(
      "Logs file must contain an array of { topics, data } objects with 1-4 topics.",
    );
  }
  return result.data;
}

/**
 * Runs the CLI and returns the process exit code. No call to process.exit makes
 * the command testable and keeps output streams injectable.
 */
export async function run(argv: string[], options: RunOptions = {}): Promise<number> {
  const stdout = options.stdout ?? ((line: string) => process.stdout.write(`${line}\n`));
  const stderr = options.stderr ?? ((line: string) => process.stderr.write(`${line}\n`));
  const env = options.env ?? process.env;
  const apiUrl = env.ATLAS_API_URL;

  let exitCode = 0;
  const program = new Command();

  const fail = (error: unknown): void => {
    if (error instanceof AtlasSdkError) {
      stderr(`Error (${error.code}): ${error.message}`);
      if (error.requestId) stderr(`Request ID: ${error.requestId}`);
      exitCode = cliExitCode(error.code);
      return;
    }
    if (error instanceof UsageError) {
      stderr(`Error: ${error.message}`);
      exitCode = 2;
      return;
    }
    stderr(`Error: ${error instanceof Error ? error.message : "unknown failure"}`);
    exitCode = 1;
  };

  const clientFor = (): CliClient => {
    if (options.client) return options.client;
    const timeoutRaw = program.opts().timeout as string | undefined;
    const timeoutMs = timeoutRaw ? parsePositiveInteger(timeoutRaw, "--timeout") : undefined;
    const baseUrl = (program.opts().apiUrl as string | undefined) ?? apiUrl;
    const clientOptions: AtlasClientOptions = {
      ...(baseUrl !== undefined ? { baseUrl } : {}),
      ...(timeoutMs !== undefined ? { timeoutMs } : {}),
    };
    return new AtlasClient(clientOptions);
  };

  const perform = async <T>(
    work: () => Promise<T>,
    render: (result: T) => string,
    json: boolean,
  ): Promise<void> => {
    try {
      const result = await work();
      stdout(json ? JSON.stringify(result, null, 2) : render(result));
    } catch (error) {
      fail(error);
    }
  };

  program
    .name("atlas")
    .description("Query the ATLAS canonical signature registry and inspect EVM data.")
    .version(CLI_VERSION)
    .option("--api-url <url>", "ATLAS API base URL (defaults to ATLAS_API_URL)")
    .option("--timeout <ms>", "request timeout in milliseconds", "15000")
    .exitOverride()
    .configureOutput({
      writeOut: (text) => stdout(text.trimEnd()),
      writeErr: (text) => stderr(text.trimEnd()),
    });

  program
    .command("lookup")
    .argument("<selector>", "4-byte function selector")
    .option("--json", "print JSON")
    .description("Look up canonical function signatures for a selector")
    .action(async (selector: string, _options: unknown, command: Command) => {
      await perform(
        () => clientFor().lookupFunction(selector),
        formatLookup,
        Boolean(command.opts().json),
      );
    });

  program
    .command("search")
    .argument("<query>", "signature text to match")
    .option("--limit <n>", "maximum results (1-100)")
    .option("--cursor <cursor>", "pagination cursor")
    .option("--json", "print JSON")
    .description("Search canonical function signatures")
    .action(async (query: string, _options: unknown, command: Command) => {
      await perform(
        () => {
          const limit = parseLimit(command.opts().limit);
          const cursor = command.opts().cursor as string | undefined;
          return clientFor().searchFunctions(query, {
            ...(limit !== undefined ? { limit } : {}),
            ...(cursor ? { cursor } : {}),
          });
        },
        (result) => formatSearch(result, query),
        Boolean(command.opts().json),
      );
    });

  program
    .command("decode")
    .argument("<calldata>", "0x-prefixed calldata")
    .option("--json", "print JSON")
    .description("Decode calldata against every canonical candidate")
    .action(async (calldata: string, _options: unknown, command: Command) => {
      await perform(
        () => clientFor().decodeCalldata(calldata),
        formatDecode,
        Boolean(command.opts().json),
      );
    });

  program
    .command("event")
    .argument("<topic0>", "32-byte event topic0")
    .option("--json", "print JSON")
    .description("Look up canonical event signatures for a topic0")
    .action(async (topic0: string, _options: unknown, command: Command) => {
      await perform(
        () => clientFor().lookupEvent(topic0),
        formatEvent,
        Boolean(command.opts().json),
      );
    });

  program
    .command("logs")
    .requiredOption("--file <path>", "JSON file with an array of { topics, data } logs")
    .option("--json", "print JSON")
    .description("Decode logs against canonical event signatures")
    .action(async (_options: unknown, command: Command) => {
      await perform(
        async () => {
          const logs = await readLogs(command.opts().file);
          return clientFor().decodeLogs(logs);
        },
        formatLogs,
        Boolean(command.opts().json),
      );
    });

  program
    .command("tx")
    .argument("<hash>", "32-byte transaction hash")
    .requiredOption("--chain <chainId>", "chain id (1 or 11155111)")
    .option("--json", "print JSON")
    .description("Investigate a transaction from verified RPC data")
    .action(async (hash: string, _options: unknown, command: Command) => {
      const chainId = parsePositiveInteger(command.opts().chain, "--chain");
      await perform(
        () => clientFor().analyzeTransaction({ chainId, hash }),
        formatTransaction,
        Boolean(command.opts().json),
      );
    });

  program
    .command("doctor")
    .option("--json", "print JSON")
    .description("Check API and Arkiv connectivity without writing anything")
    .action(async (_options: unknown, command: Command) => {
      try {
        const health = await clientFor().health();
        if (command.opts().json) {
          stdout(JSON.stringify(health, null, 2));
        } else {
          stdout(formatHealth(health, apiUrl ?? "http://localhost:3000"));
        }
        exitCode = health.status === "ok" ? 0 : 1;
      } catch (error) {
        fail(error);
      }
    });

  try {
    await program.parseAsync(argv, { from: "user" });
  } catch (error) {
    if (error instanceof CommanderError) {
      if (error.code === "commander.helpDisplayed" || error.code === "commander.version") {
        return 0;
      }
      if (exitCode === 0) exitCode = 2;
    } else {
      fail(error);
    }
  }

  return exitCode;
}
