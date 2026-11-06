import { z } from "zod";

/** A bounded, read-only Swarm artifact returned by ATLAS's configured Bee API. */
export const SwarmArtifactSchema = z.object({
  source: z.literal("swarm"),
  reference: z.string().regex(/^[0-9a-f]{64}$/),
  contentType: z.string().min(1).max(128),
  bytes: z.number().int().nonnegative().max(65536),
  sha256: z.string().regex(/^0x[0-9a-f]{64}$/),
  contentBase64: z.string(),
});
export type SwarmArtifact = z.infer<typeof SwarmArtifactSchema>;
