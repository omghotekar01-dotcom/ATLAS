import { z } from "zod";
import { AddressSchema } from "./primitives.js";

const DecimalUint256 = z
  .string()
  .max(78)
  .regex(/^(0|[1-9][0-9]*)$/, "Expected a decimal uint256.")
  .refine((value) => {
    try {
      return BigInt(value) <= (1n << 256n) - 1n;
    } catch {
      return false;
    }
  }, "Uint256 exceeds 256 bits.");

/** A read-only EAC role assertion from a configured on-chain contract.
 * This is not proof that a publisher controls an ABI or a separate contract. */
export const EnsV2RoleResultSchema = z.object({
  kind: z.literal("ensv2-eac-role"),
  chainId: z.literal([1, 11155111]),
  registry: AddressSchema,
  account: AddressSchema,
  resource: DecimalUint256,
  requiredRoles: DecimalUint256,
  roleBitmap: DecimalUint256,
  authorized: z.boolean(),
  blockNumber: DecimalUint256,
  publisher: z
    .object({
      name: z.string().min(1).max(255),
      owner: AddressSchema,
      resolver: AddressSchema.nullable(),
    })
    .optional(),
  warnings: z.array(z.string()),
});

export type EnsV2RoleResult = z.infer<typeof EnsV2RoleResultSchema>;
