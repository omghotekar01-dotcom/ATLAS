import {
  createPublicClient,
  getAddress,
  http,
  keccak256,
  parseAbi,
  toHex,
  zeroAddress,
} from "viem";
import { normalize } from "viem/ens";
import { mainnet, sepolia } from "viem/chains";
import {
  AddressSchema,
  EnsV2RoleResultSchema,
  InvalidInputError,
  AtlasError,
  NotFoundError,
  UpstreamUnavailableError,
  type EnsV2RoleResult,
} from "@atlas/schemas";

/** Real ENSv2 Enhanced Access Control view methods (not ENSv1 name resolution). */
const EAC_ABI = parseAbi([
  "function hasRoles(uint256 resource, uint256 roleBitmap, address account) view returns (bool)",
  "function getSubregistry(string label) view returns (address)",
  "function getResolver(string label) view returns (address)",
  "function findOwner(string label) view returns (address)",
  "function getResource(uint256 id) view returns (uint256)",
  "function roles(uint256 resource, address account) view returns (uint256)",
]);
// Official ENSv2 ETHRegistry deployments. Name traversal always starts here.
const ETH_REGISTRIES = {
  1: "0xf60aba43e1f7f3dab1186ff03b561401c9df85e2",
  11155111: "0xd4ebcbbdf463c9c45784603db0ddd499bc44a8b4",
} as const;
const U256_MAX = (1n << 256n) - 1n;

export function parseRoleUint256(raw: string | undefined, fallback: bigint): bigint {
  if (raw === undefined) return fallback;
  if (typeof raw !== "string" || raw.length > 78 || !/^(0|[1-9][0-9]*)$/.test(raw)) {
    throw new InvalidInputError("EAC resource and role bitmap must be decimal uint256 values.");
  }
  const parsed = BigInt(raw);
  if (parsed > U256_MAX) throw new InvalidInputError("EAC value exceeds uint256.");
  return parsed;
}

/**
 * Read-only ENSv2 EAC proof on Ethereum Mainnet or Sepolia. The registry address MUST be checked
 * against the official deployment or a verifiable per-name registry. This
 * method never grants a role, writes records, or spends gas.
 */
export async function readEnsV2Role(
  accountRaw: string,
  resourceRaw?: string,
  roleRaw?: string,
  env: Readonly<Record<string, string | undefined>> = process.env,
  nameRaw?: string,
): Promise<EnsV2RoleResult> {
  const parsed = AddressSchema.safeParse(accountRaw);
  if (!parsed.success) throw new InvalidInputError("Expected a 20-byte account address.");
  const account = getAddress(parsed.data);
  let resource = parseRoleUint256(resourceRaw, 0n);
  let name: string | undefined;
  if (nameRaw !== undefined) {
    if (typeof nameRaw !== "string" || nameRaw.length > 255 || resourceRaw !== undefined) {
      throw new InvalidInputError("Supply an ENS name or a resource, never both.");
    }
    try {
      name = normalize(nameRaw);
    } catch {
      throw new InvalidInputError("Invalid ENS name.");
    }
    if (!name.endsWith(".eth") || name.split(".").length > 4) {
      throw new InvalidInputError("Use a .eth name with at most two subname levels.");
    }
  }
  // ROLE_SET_RESOLVER (1 << 24) on a PermissionedRegistry.
  const role = parseRoleUint256(roleRaw, 1n << 24n);
  if (role === 0n) throw new InvalidInputError("The role bitmap must not be zero.");
  const configuredChain = env.ATLAS_ENSV2_CHAIN_ID?.trim() || "11155111";
  if (configuredChain !== "1" && configuredChain !== "11155111") {
    throw new UpstreamUnavailableError("ENSv2 supports Ethereum Mainnet and Sepolia.");
  }
  const chain = configuredChain === "1" ? mainnet : sepolia;
  const rpcKey = `ATLAS_RPC_URL_${chain.id}`;
  const rpcUrl = env[rpcKey]?.trim();
  const registryRaw = name ? ETH_REGISTRIES[chain.id] : env.ATLAS_ENSV2_REGISTRY?.trim();
  if (!rpcUrl || !registryRaw) {
    throw new UpstreamUnavailableError(
      `ENSv2 role reader requires ${rpcKey} and ATLAS_ENSV2_REGISTRY on the API.`,
    );
  }
  const registryParsed = AddressSchema.safeParse(registryRaw);
  if (!registryParsed.success)
    throw new UpstreamUnavailableError("Invalid configured ENSv2 registry address.");
  let registry = getAddress(registryParsed.data);
  let rpc: URL;
  try {
    rpc = new URL(rpcUrl);
  } catch {
    throw new UpstreamUnavailableError("Invalid ENSv2 RPC URL configuration.");
  }
  if (
    rpc.protocol !== "https:" &&
    !(rpc.protocol === "http:" && ["localhost", "127.0.0.1"].includes(rpc.hostname))
  ) {
    throw new UpstreamUnavailableError(
      "ENSv2 RPC must use HTTPS, or loopback HTTP in local development.",
    );
  }
  const client = createPublicClient({
    chain,
    transport: http(rpc.toString(), { timeout: 4_000, retryCount: 0 }),
  });
  try {
    const [actualChain, blockNumber] = await Promise.all([
      client.getChainId(),
      client.getBlockNumber(),
    ]);
    if (actualChain !== chain.id) throw new Error("ENSv2 RPC is connected to the wrong chain.");
    const bytecode = await client.getBytecode({ address: registry, blockNumber });
    if (!bytecode || bytecode === "0x")
      throw new Error("ENSv2 registry has no contract code at its configured address.");
    let publisher;
    if (name) {
      const [label, ...parents] = name.split(".").slice(0, -1);
      if (!label) throw new InvalidInputError("Expected a publisher label.");
      for (const parent of parents.reverse()) {
        registry = await client.readContract({
          address: registry,
          abi: EAC_ABI,
          blockNumber,
          functionName: "getSubregistry",
          args: [parent],
        });
        if (registry === zeroAddress)
          throw new NotFoundError("No active ENSv2 parent subregistry.");
      }
      const [owner, resolver, currentResource] = await Promise.all([
        client.readContract({
          address: registry,
          abi: EAC_ABI,
          blockNumber,
          functionName: "findOwner",
          args: [label],
        }),
        client.readContract({
          address: registry,
          abi: EAC_ABI,
          blockNumber,
          functionName: "getResolver",
          args: [label],
        }),
        client.readContract({
          address: registry,
          abi: EAC_ABI,
          blockNumber,
          functionName: "getResource",
          args: [BigInt(keccak256(toHex(label)))],
        }),
      ]);
      if (owner === zeroAddress)
        throw new NotFoundError("No active ENSv2 registration for this name.");
      resource = currentResource;
      publisher = { name, owner, resolver: resolver === zeroAddress ? null : resolver };
    }
    const [authorized, roleBitmap] = await Promise.all([
      client.readContract({
        address: registry,
        abi: EAC_ABI,
        blockNumber,
        functionName: "hasRoles",
        args: [resource, role, account],
      }),
      client.readContract({
        address: registry,
        abi: EAC_ABI,
        blockNumber,
        functionName: "roles",
        args: [resource, account],
      }),
    ]);
    return EnsV2RoleResultSchema.parse({
      kind: "ensv2-eac-role",
      chainId: chain.id,
      registry,
      account,
      resource: resource.toString(),
      requiredRoles: role.toString(),
      roleBitmap: roleBitmap.toString(),
      authorized,
      ...(publisher ? { publisher } : {}),
      blockNumber: blockNumber.toString(),
      warnings: [
        "This proves the EAC role response at the configured contract and block, not that a publisher owns the ABI or source.",
        "Confirm ATLAS_ENSV2_REGISTRY is an official or provenance-verified ENSv2 PermissionedRegistry contract.",
        ...(resource === 0n ? ["Resource 0 checks the root role, not a specific ENS name."] : []),
      ],
    });
  } catch (error) {
    if (error instanceof AtlasError) throw error;
    throw new UpstreamUnavailableError(
      "ENSv2 on-chain role lookup failed.",
      { chainId: chain.id },
      { cause: error },
    );
  }
}
