#!/usr/bin/env node
/* globals process, console */
/**
 * Contract-check API with an explicit in-memory repository.
 *
 * This is NOT Arkiv data and must not be presented as such. It exists so
 * `scripts/consistency.mjs` can prove that REST, SDK and CLI agree on one
 * contract while no Arkiv credentials are configured.
 *
 *   node scripts/fixture-api.mjs --port 3112
 */
import { createApp } from "../services/api/dist/app-factory.js";

const portArgument = process.argv.indexOf("--port");
const port = portArgument >= 0 ? Number(process.argv[portArgument + 1]) : 3112;

const importedAt = "2026-11-06T00:00:00.000Z";
const datasetVersion = "fixture@consistency-check";
const source = "consistency-fixture";

function record(signature, selector, suffix) {
  return {
    selector,
    signature,
    source,
    sourceId: `${source}:${suffix}`,
    importedAt,
    datasetVersion,
    recordHash: `0x${suffix.repeat(64).slice(0, 64)}`,
    entityKey: `0x${suffix.toUpperCase().repeat(64).slice(0, 64)}`,
  };
}

const records = [
  record("transfer(address,uint256)", "0xa9059cbb", "a"),
  record("many_msg_babbage(bytes1)", "0xa9059cbb", "b"),
];

const dependencies = {
  functions: {
    async findBySelector(selector) {
      return records.filter((entry) => entry.selector === selector);
    },
    async findByRecordHash(hash) {
      return records.filter((entry) => entry.recordHash === hash);
    },
    async searchBySignature(query, options) {
      const matches = records.filter((entry) =>
        entry.signature.toLowerCase().includes(query.toLowerCase()),
      );
      const start = options.cursor ? Number(options.cursor) : 0;
      const items = matches.slice(start, start + options.limit);
      return {
        items,
        nextCursor: start + options.limit < matches.length ? String(start + options.limit) : null,
      };
    },
  },
  events: {
    async findByTopic0() {
      return [];
    },
  },
  chains: {
    get() {
      return undefined;
    },
  },
  async health() {
    return { arkiv: { connected: true } };
  },
  version: "fixture",
};

const app = createApp({
  dependencies,
  logger: false,
  rateLimitPerMinute: 1000,
  upstreamTimeoutMs: 5000,
});

await app.listen({ port, host: "127.0.0.1" });
console.log(`fixture API (not Arkiv) on http://127.0.0.1:${port}`);
