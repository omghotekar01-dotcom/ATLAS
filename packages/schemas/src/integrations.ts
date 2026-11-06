import { z } from "zod";

const state = z.enum([
  "connected",
  "configured-unprobed",
  "disconnected",
  "unconfigured",
  "rate-limited",
  "unsupported",
]);

export const IntegrationStatusSchema = z.object({
  arkiv: state,
  swarm: state,
  ensv2: state,
  zeroG: state,
  anonRpc: z.literal("browser-only"),
});
export type IntegrationStatus = z.infer<typeof IntegrationStatusSchema>;
