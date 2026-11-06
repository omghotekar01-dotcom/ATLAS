import { bytes, defineSchema, str, type Column, type Schema } from "@arkiv-network/sdk/schema";

type FunctionSignatureColumns = {
  selector: Column<"str", true, false, false>;
  signature: Column<"bytes", false, false, false>;
  source: Column<"str", true, false, false>;
  sourceId: Column<"str", true, false, false>;
  sourceUpdatedAt: Column<"str", false, true, false>;
  importedAt: Column<"str", true, false, false>;
  datasetVersion: Column<"str", true, false, false>;
  recordHash: Column<"str", true, false, false>;
};

export const FunctionSignatures: Schema<FunctionSignatureColumns> = defineSchema(
  "atlas.function-signatures",
  {
    selector: str().indexed(),
    signature: bytes(),
    source: str().indexed(),
    sourceId: str().indexed(),
    sourceUpdatedAt: str().optional(),
    importedAt: str().indexed(),
    datasetVersion: str().indexed(),
    recordHash: str().indexed(),
  },
);

type EventSignatureColumns = {
  topic0: Column<"str", true, false, false>;
  signature: Column<"bytes", false, false, false>;
  indexed: Column<"str", false, true, false>;
  source: Column<"str", true, false, false>;
  sourceId: Column<"str", true, false, false>;
  importedAt: Column<"str", true, false, false>;
  datasetVersion: Column<"str", true, false, false>;
  recordHash: Column<"str", true, false, false>;
};

export const EventSignatures: Schema<EventSignatureColumns> = defineSchema(
  "atlas.event-signatures",
  {
    topic0: str().indexed(),
    signature: bytes(),
    indexed: str().optional(),
    source: str().indexed(),
    sourceId: str().indexed(),
    importedAt: str().indexed(),
    datasetVersion: str().indexed(),
    recordHash: str().indexed(),
  },
);
