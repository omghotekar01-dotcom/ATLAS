import { createPublicClient, custom, type PublicClient } from "viem";
import { mainnet } from "viem/chains";

export const TX_HASH = `0x${"a".repeat(64)}`;
export const FROM = "0x0000000000000000000000000000000000000001";
export const TO = "0x0000000000000000000000000000000000000002";

export const RAW_TRANSACTION = {
  hash: TX_HASH,
  nonce: "0x1",
  blockHash: `0x${"b".repeat(64)}`,
  blockNumber: "0x10",
  transactionIndex: "0x0",
  from: FROM,
  to: TO,
  value: "0x0",
  gas: "0x5208",
  gasPrice: "0x1",
  input: "0xa9059cbb",
  v: "0x1b",
  r: `0x${"1".repeat(64)}`,
  s: `0x${"2".repeat(64)}`,
  type: "0x0",
};

export const RAW_RECEIPT = {
  transactionHash: TX_HASH,
  transactionIndex: "0x0",
  blockHash: `0x${"b".repeat(64)}`,
  blockNumber: "0x10",
  from: FROM,
  to: TO,
  cumulativeGasUsed: "0x5208",
  gasUsed: "0x5208",
  effectiveGasPrice: "0x1",
  contractAddress: null,
  logs: [],
  logsBloom: `0x${"0".repeat(512)}`,
  status: "0x1",
  type: "0x0",
};

export function fakeClient(handler: (method: string, params: unknown) => unknown): PublicClient {
  return createPublicClient({
    chain: mainnet,
    transport: custom({
      request: ({ method, params }) => Promise.resolve(handler(method, params)),
    }),
  });
}
