import { z } from "zod";
import {
  AddressSchema,
  ChainIdSchema,
  EntityKeySchema,
  HashSchema,
  HexDataSchema,
  JsonValueSchema,
  SelectorSchema,
  SignatureSchema,
  TimestampSchema,
  Topic0Schema,
} from "./primitives.js";

export const ProvenanceSchema = z.object({
  datasetVersion: z.string().trim().min(1),
  importedAt: TimestampSchema,
  recordHash: HashSchema,
});

export const SignatureCandidateSchema = z.object({
  signature: SignatureSchema,
  source: z.string().trim().min(1),
  sourceId: z.string().trim().min(1),
  entityKey: EntityKeySchema,
  provenance: ProvenanceSchema,
});

const LookupFieldsSchema = z.object({
  ambiguous: z.boolean(),
  candidates: z.array(SignatureCandidateSchema),
  registry: z.string().trim().min(1),
  warnings: z.array(z.string()),
});

export const FunctionLookupResultSchema = LookupFieldsSchema.extend({
  identifier: SelectorSchema,
  kind: z.literal("function"),
}).refine((result) => result.ambiguous === result.candidates.length > 1, {
  message: "ambiguous must be true exactly when multiple candidates are present.",
  path: ["ambiguous"],
});

export const EventLookupResultSchema = LookupFieldsSchema.extend({
  identifier: Topic0Schema,
  kind: z.literal("event"),
}).refine((result) => result.ambiguous === result.candidates.length > 1, {
  message: "ambiguous must be true exactly when multiple candidates are present.",
  path: ["ambiguous"],
});

export const LookupResultSchema = z.union([FunctionLookupResultSchema, EventLookupResultSchema]);

export const FunctionSearchItemSchema = SignatureCandidateSchema.extend({
  selector: SelectorSchema,
});

export const FunctionSearchResultSchema = z.object({
  items: z.array(FunctionSearchItemSchema),
  pagination: z.object({
    nextCursor: z.string().nullable(),
  }),
});

export const HealthResponseSchema = z.object({
  status: z.enum(["ok", "degraded"]),
  version: z.string().trim().min(1),
  arkiv: z
    .object({
      connected: z.boolean(),
    })
    .optional(),
});

export const DecodedArgumentSchema = z.object({
  name: z.string().trim().min(1),
  type: z.string().trim().min(1),
  value: JsonValueSchema,
});

export const FunctionDecodeAttemptSchema = z.discriminatedUnion("decodeStatus", [
  z.object({
    signature: SignatureSchema,
    provenance: ProvenanceSchema,
    decodeStatus: z.literal("success"),
    arguments: z.array(DecodedArgumentSchema),
  }),
  z.object({
    signature: SignatureSchema,
    provenance: ProvenanceSchema,
    decodeStatus: z.literal("failed"),
    error: z.string().trim().min(1),
  }),
]);

export const CalldataDecodeResultSchema = z.object({
  selector: SelectorSchema,
  ambiguous: z.boolean(),
  decoded: z.array(FunctionDecodeAttemptSchema),
  warnings: z.array(z.string()),
});

export const EventDecodeAttemptSchema = z.discriminatedUnion("decodeStatus", [
  z.object({
    signature: SignatureSchema,
    provenance: ProvenanceSchema,
    decodeStatus: z.literal("success"),
    arguments: z.array(DecodedArgumentSchema),
  }),
  z.object({
    signature: SignatureSchema,
    provenance: ProvenanceSchema,
    decodeStatus: z.literal("failed"),
    error: z.string().trim().min(1),
  }),
]);

export const LogDecodeResultSchema = z.object({
  topic0: Topic0Schema,
  ambiguous: z.boolean(),
  decoded: z.array(EventDecodeAttemptSchema),
  warnings: z.array(z.string()),
});

export const TransactionInvestigationSchema = z.object({
  transaction: z.object({
    hash: HashSchema,
    chainId: ChainIdSchema,
    from: AddressSchema,
    to: AddressSchema.nullable(),
    input: HexDataSchema,
    blockNumber: z.number().int().nonnegative().safe().nullable(),
    source: z.literal("rpc"),
  }),
  receipt: z
    .object({
      status: z.enum(["success", "reverted"]),
      source: z.literal("rpc"),
    })
    .nullable(),
  functionLookup: FunctionLookupResultSchema.nullable(),
  functionDecode: CalldataDecodeResultSchema.nullable(),
  eventResults: z.array(LogDecodeResultSchema),
  limitations: z.array(z.string()),
  warnings: z.array(z.string()),
});

export type Provenance = z.infer<typeof ProvenanceSchema>;
export type SignatureCandidate = z.infer<typeof SignatureCandidateSchema>;
export type FunctionLookupResult = z.infer<typeof FunctionLookupResultSchema>;
export type EventLookupResult = z.infer<typeof EventLookupResultSchema>;
export type LookupResult = z.infer<typeof LookupResultSchema>;
export type FunctionSearchItem = z.infer<typeof FunctionSearchItemSchema>;
export type FunctionSearchResult = z.infer<typeof FunctionSearchResultSchema>;
export type HealthResponse = z.infer<typeof HealthResponseSchema>;
export type DecodedArgument = z.infer<typeof DecodedArgumentSchema>;
export type FunctionDecodeAttempt = z.infer<typeof FunctionDecodeAttemptSchema>;
export type CalldataDecodeResult = z.infer<typeof CalldataDecodeResultSchema>;
export type EventDecodeAttempt = z.infer<typeof EventDecodeAttemptSchema>;
export type LogDecodeResult = z.infer<typeof LogDecodeResultSchema>;
export type TransactionInvestigation = z.infer<typeof TransactionInvestigationSchema>;

export type LogInput = z.infer<typeof LogInputSchema>;

export const LogInputSchema = z.object({
  topics: z.array(Topic0Schema).min(1).max(4),
  data: HexDataSchema,
});
