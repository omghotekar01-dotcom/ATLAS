/** 4byte.directory is an unverified community suggestion source, NEVER canonical Arkiv data. */
import { z } from "zod";
import { SelectorSchema } from "./primitives.js";

export const CommunityCandidateSchema = z.object({
  id: z.number().int().nonnegative(),
  signature: z.string().trim().min(1).max(512),
  selector: SelectorSchema,
});

export const CommunityLookupResultSchema = z.object({
  selector: SelectorSchema,
  registry: z.literal("4byte.directory"),
  canonical: z.literal(false),
  candidates: z.array(CommunityCandidateSchema),
  total: z.number().int().nonnegative(),
  truncated: z.boolean(),
  warnings: z.array(z.string()),
});

export type CommunityLookupResult = z.infer<typeof CommunityLookupResultSchema>;
export type CommunityCandidate = z.infer<typeof CommunityCandidateSchema>;
