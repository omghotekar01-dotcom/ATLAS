import { z } from "zod";
import {
  AddressSchema,
  ChainIdSchema,
  HashSchema,
  SignatureSchema,
  SelectorSchema,
  TimestampSchema,
  Topic0Schema,
} from "./primitives.js";

export const FunctionSignatureSchema = z.object({
  selector: SelectorSchema,
  signature: SignatureSchema,
  source: z.string().trim().min(1),
  sourceId: z.string().trim().min(1),
  sourceUpdatedAt: TimestampSchema.optional(),
  importedAt: TimestampSchema,
  datasetVersion: z.string().trim().min(1),
  recordHash: HashSchema,
});

export const EventSignatureSchema = z.object({
  topic0: Topic0Schema,
  signature: SignatureSchema,
  /** Indexed-parameter layout in declaration order, when known. */
  indexed: z.array(z.boolean()).optional(),
  source: z.string().trim().min(1),
  sourceId: z.string().trim().min(1),
  importedAt: TimestampSchema,
  datasetVersion: z.string().trim().min(1),
  recordHash: HashSchema,
});

const ObservationFieldsSchema = z.object({
  signature: SignatureSchema,
  chainId: z.union([ChainIdSchema, z.literal("global")]),
  contractAddress: z.union([AddressSchema, z.literal("global")]),
  evidenceUrl: z.url({ protocol: /^https?$/ }).optional(),
  status: z.enum(["unverified", "supported", "rejected"]),
  submittedAt: TimestampSchema,
  observationHash: HashSchema,
});

export const ObservationSchema = z.discriminatedUnion("kind", [
  ObservationFieldsSchema.extend({
    kind: z.literal("function"),
    identifier: SelectorSchema,
  }),
  ObservationFieldsSchema.extend({
    kind: z.literal("event"),
    identifier: Topic0Schema,
  }),
]);

export const ImportManifestSchema = z.object({
  source: z.string().trim().min(1),
  endpoint: z.url({ protocol: /^https?$/ }),
  importerVersion: z.string().trim().min(1),
  datasetVersion: z.string().trim().min(1),
  startedAt: TimestampSchema,
  completedAt: TimestampSchema.optional(),
  counts: z.object({
    fetched: z.number().int().nonnegative().safe(),
    validated: z.number().int().nonnegative().safe(),
    imported: z.number().int().nonnegative().safe(),
    skipped: z.number().int().nonnegative().safe(),
    failed: z.number().int().nonnegative().safe(),
  }),
  snapshot: z
    .object({
      method: z.enum(["git", "local"]),
      treeDigest: HashSchema,
      files: z.number().int().nonnegative().safe(),
      bytes: z.number().int().nonnegative().safe(),
      fetchedAt: TimestampSchema,
      license: z.object({
        spdx: z.string().trim().min(1),
        file: z.string().trim().min(1),
        sha256: z.union([HashSchema, z.literal("")]),
        url: z.url({ protocol: /^https?$/ }),
        verified: z.boolean(),
      }),
    })
    .optional(),
  failureSummary: z.array(z.string()),
  licenseUrl: z.url({ protocol: /^https?$/ }),
  importerIdentity: z.string().trim().min(1),
});

export type FunctionSignature = z.infer<typeof FunctionSignatureSchema>;
export type EventSignature = z.infer<typeof EventSignatureSchema>;
export type Observation = z.infer<typeof ObservationSchema>;
export type ImportManifest = z.infer<typeof ImportManifestSchema>;
