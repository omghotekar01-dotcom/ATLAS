import { z } from "zod";
import { ChainIdSchema, HashSchema, HexDataSchema } from "./primitives.js";
import { LogInputSchema } from "./results.js";

export const DecodeCalldataRequestSchema = z.object({
  calldata: HexDataSchema,
  /**
   * Accepted for contract compatibility. ATLAS always returns every candidate
   * outcome; the field does not turn an honest empty/failed decode into a
   * fabricated success.
   */
  strict: z.boolean().optional().default(false),
});

export const DecodeLogsRequestSchema = z.object({
  logs: z.array(LogInputSchema).min(1).max(20),
});

export const AnalyzeTransactionRequestSchema = z.object({
  chainId: ChainIdSchema,
  hash: HashSchema,
});

export type DecodeCalldataRequest = z.infer<typeof DecodeCalldataRequestSchema>;
export type DecodeLogsRequest = z.infer<typeof DecodeLogsRequestSchema>;
export type AnalyzeTransactionRequest = z.infer<typeof AnalyzeTransactionRequestSchema>;
