import { z } from "zod";
import { HexDataSchema } from "./primitives.js";
import { CalldataDecodeResultSchema } from "./results.js";

/** Explicit, opt-in request: no user keys or secrets, just public EVM calldata. */
export const ExplainRequestSchema = z.object({
  calldata: HexDataSchema.refine((value) => value.length >= 10 && value.length <= 16_386, {
    message: "Provide 4 to 8192 calldata bytes including the selector.",
  }),
});

export const ExplainResultSchema = z.object({
  provider: z.literal("0g-private-computer"),
  status: z.literal("ai-interpretation"),
  model: z.string().trim().min(1).max(128),
  requestId: z.string().trim().min(1).max(256).nullable(),
  explanation: z.string().trim().min(1).max(6000),
  decoded: CalldataDecodeResultSchema,
  warnings: z.array(z.string()),
});
export type ExplainResult = z.infer<typeof ExplainResultSchema>;
