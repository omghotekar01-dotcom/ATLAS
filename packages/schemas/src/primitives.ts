import { z } from "zod";

function normalizeHex(value: string): string {
  return value.trim().toLowerCase().replace(/^0x/i, "0x");
}

export function normalizeSelector(value: string): Selector {
  return SelectorSchema.parse(value);
}

export function normalizeTopic0(value: string): Topic0 {
  return Topic0Schema.parse(value);
}

export function normalizeAddress(value: string): Address {
  return AddressSchema.parse(value);
}

export function normalizeHexData(value: string): HexData {
  return HexDataSchema.parse(value);
}

export function normalizeSignature(value: string): string {
  return value
    .trim()
    .replace(/\s*\(\s*/g, "(")
    .replace(/\s*\)\s*/g, ")")
    .replace(/\s*,\s*/g, ",");
}

export const SelectorSchema = z
  .string()
  .trim()
  .regex(/^0x[0-9a-f]{8}$/i, "Expected a 4-byte hexadecimal selector.")
  .transform(normalizeHex)
  .brand<"Selector">();

export const Topic0Schema = z
  .string()
  .trim()
  .regex(/^0x[0-9a-f]{64}$/i, "Expected a 32-byte hexadecimal topic0.")
  .transform(normalizeHex)
  .brand<"Topic0">();

export const AddressSchema = z
  .string()
  .trim()
  .regex(/^0x[0-9a-f]{40}$/i, "Expected a 20-byte hexadecimal address.")
  .transform(normalizeHex)
  .brand<"Address">();

export const HashSchema = z
  .string()
  .trim()
  .regex(/^0x[0-9a-f]{64}$/i, "Expected a 32-byte hexadecimal hash.")
  .transform(normalizeHex)
  .brand<"Hash">();

export const HexDataSchema = z
  .string()
  .trim()
  .regex(/^0x(?:[0-9a-f]{2})*$/i, "Expected hexadecimal data with an even number of bytes.")
  .transform(normalizeHex)
  .brand<"HexData">();

export const ChainIdSchema = z.number().int().positive().safe().brand<"ChainId">();
export const TimestampSchema = z.iso.datetime({ offset: true }).brand<"Timestamp">();
export const EntityKeySchema = z.string().trim().min(1).brand<"EntityKey">();
export const SignatureSchema = z.string().trim().min(1).transform(normalizeSignature);

export type Selector = z.infer<typeof SelectorSchema>;
export type Topic0 = z.infer<typeof Topic0Schema>;
export type Address = z.infer<typeof AddressSchema>;
export type Hash = z.infer<typeof HashSchema>;
export type HexData = z.infer<typeof HexDataSchema>;
export type ChainId = z.infer<typeof ChainIdSchema>;
export type Timestamp = z.infer<typeof TimestampSchema>;
export type EntityKey = z.infer<typeof EntityKeySchema>;
export type Signature = z.infer<typeof SignatureSchema>;

export const JsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    z.string(),
    z.number().finite(),
    z.boolean(),
    z.null(),
    z.array(JsonValueSchema),
    z.record(z.string(), JsonValueSchema),
  ]),
);

export type JsonValue =
  string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };
