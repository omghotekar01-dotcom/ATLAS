/**
 * Deterministic extraction of canonical function and event signatures from
 * Solidity source.
 *
 * Only signatures whose types are canonical ABI types are emitted. A project-wide
 * symbol table resolves the declarations that Solidity source commonly uses:
 *
 * - contracts, interfaces and libraries -> `address`
 * - enums -> `uint8`
 * - user-defined value types -> their underlying elementary type
 * - structs -> ABI tuples `(type1,type2,...)`, recursively
 *
 * Anything still unresolved (unknown type, ambiguous declaration, recursive
 * struct, function/mapping type, non-literal array length) is rejected with a
 * structured reason. Guessing would produce a wrong selector/topic0, so the
 * extractor never guesses.
 */
import { parse } from "@solidity-parser/parser";
import type {
  ArrayTypeName,
  ASTNode,
  ContractDefinition,
  ElementaryTypeName,
  EnumDefinition,
  EventDefinition,
  FunctionDefinition,
  StructDefinition,
  TypeDefinition,
  TypeName,
  VariableDeclaration,
} from "@solidity-parser/parser/dist/src/ast-types.js";
import { toEventSelector, toFunctionSelector } from "viem";

import type { ExtractionSource } from "./sources.js";

export interface FunctionDraft {
  readonly kind: "function";
  readonly selector: string;
  readonly signature: string;
  readonly source: string;
  readonly sourceId: string;
}

export interface EventDraft {
  readonly kind: "event";
  readonly topic0: string;
  readonly signature: string;
  readonly source: string;
  readonly sourceId: string;
}

export type SignatureDraft = FunctionDraft | EventDraft;

export type RejectionKind = "function" | "event" | "file";

export interface Rejection {
  readonly filePath: string;
  readonly kind: RejectionKind;
  readonly declaration: string;
  readonly reason: string;
}

export interface ExtractionResult {
  readonly functions: FunctionDraft[];
  readonly events: EventDraft[];
  readonly rejections: Rejection[];
}

const ELEMENTARY_TYPES = new Set([
  "address",
  "bool",
  "string",
  "bytes",
  "uint8",
  "uint16",
  "uint24",
  "uint32",
  "uint40",
  "uint48",
  "uint56",
  "uint64",
  "uint72",
  "uint80",
  "uint88",
  "uint96",
  "uint104",
  "uint112",
  "uint120",
  "uint128",
  "uint136",
  "uint144",
  "uint152",
  "uint160",
  "uint168",
  "uint176",
  "uint184",
  "uint192",
  "uint200",
  "uint208",
  "uint216",
  "uint224",
  "uint232",
  "uint240",
  "uint248",
  "uint256",
  "int8",
  "int16",
  "int24",
  "int32",
  "int40",
  "int48",
  "int56",
  "int64",
  "int72",
  "int80",
  "int88",
  "int96",
  "int104",
  "int112",
  "int120",
  "int128",
  "int136",
  "int144",
  "int152",
  "int160",
  "int168",
  "int176",
  "int184",
  "int192",
  "int200",
  "int208",
  "int216",
  "int224",
  "int232",
  "int240",
  "int248",
  "int256",
]);

function canonicalElementary(node: ElementaryTypeName): string | null {
  const name = node.name.trim();
  if (name === "uint") return "uint256";
  if (name === "int") return "int256";
  if (name === "byte") return "bytes1";
  if (/^bytes([1-9]|[12][0-9]|3[0-2])$/.test(name)) return name;
  return ELEMENTARY_TYPES.has(name) ? name : null;
}

type SymbolKind = "contract" | "enum" | "struct" | "valuetype";

interface SymbolIndex {
  /** Every kind declared under a name. More than one kind means ambiguous. */
  kinds: Map<string, Set<SymbolKind>>;
  structs: Map<string, VariableDeclaration[][]>;
  valueTypes: Map<string, ElementaryTypeName[]>;
}

export interface SymbolTable {
  readonly index: SymbolIndex;
  /** Names that resolve differently in different files. */
  readonly ambiguous: ReadonlySet<string>;
}

export function createSymbolTable(): SymbolTable {
  return {
    index: { kinds: new Map(), structs: new Map(), valueTypes: new Map() },
    ambiguous: new Set(),
  };
}

function addKind(index: SymbolIndex, name: string, kind: SymbolKind): void {
  const kinds = index.kinds.get(name) ?? new Set<SymbolKind>();
  kinds.add(kind);
  index.kinds.set(name, kinds);
}

function collectLocalSymbols(ast: ASTNode): SymbolIndex {
  const index: SymbolIndex = { kinds: new Map(), structs: new Map(), valueTypes: new Map() };

  const walk = (node: ASTNode | null | undefined): void => {
    if (!node || typeof node !== "object") return;

    if (node.type === "ContractDefinition") {
      const contract = node as ContractDefinition;
      const kind: SymbolKind = "contract";
      addKind(index, contract.name, kind);
    } else if (node.type === "StructDefinition") {
      const struct = node as StructDefinition;
      addKind(index, struct.name, "struct");
      const list = index.structs.get(struct.name) ?? [];
      list.push(struct.members);
      index.structs.set(struct.name, list);
    } else if (node.type === "EnumDefinition") {
      addKind(index, (node as EnumDefinition).name, "enum");
    } else if (node.type === "TypeDefinition") {
      const definition = node as TypeDefinition;
      addKind(index, definition.name, "valuetype");
      const list = index.valueTypes.get(definition.name) ?? [];
      list.push(definition.definition);
      index.valueTypes.set(definition.name, list);
    }

    for (const value of Object.values(node)) {
      if (Array.isArray(value)) {
        for (const child of value) walk(child as ASTNode);
      } else if (value && typeof value === "object") {
        walk(value as ASTNode);
      }
    }
  };

  walk(ast);
  return index;
}

function memberKey(members: readonly VariableDeclaration[]): string {
  return members
    .map((member) => (member.typeName ? JSON.stringify(member.typeName) : "null"))
    .join("|");
}

/** Merges per-file symbol indexes, marking cross-file conflicts as ambiguous. */
export function buildSymbolTable(asts: readonly ASTNode[]): SymbolTable {
  const merged = createSymbolTable();
  const ambiguous = new Set<string>();

  for (const ast of asts) {
    const local = collectLocalSymbols(ast);
    for (const [name, kinds] of local.kinds) {
      for (const kind of kinds) addKind(merged.index, name, kind);
    }
    for (const [name, definitions] of local.structs) {
      const list = merged.index.structs.get(name) ?? [];
      list.push(...definitions);
      merged.index.structs.set(name, list);
    }
    for (const [name, definitions] of local.valueTypes) {
      const list = merged.index.valueTypes.get(name) ?? [];
      list.push(...definitions);
      merged.index.valueTypes.set(name, list);
    }
  }

  for (const [name, kinds] of merged.index.kinds) {
    if (kinds.size > 1) ambiguous.add(name);
  }
  for (const [name, definitions] of merged.index.structs) {
    const keys = new Set(definitions.map(memberKey));
    if (keys.size > 1) ambiguous.add(name);
  }
  for (const [name, definitions] of merged.index.valueTypes) {
    const names = new Set(definitions.map((definition) => definition.name));
    if (names.size > 1) ambiguous.add(name);
  }

  return { index: merged.index, ambiguous };
}

type CanonicalType = { ok: true; type: string } | { ok: false; reason: string };

interface Scope {
  readonly global: SymbolTable;
  readonly local: SymbolIndex;
  /** Struct names currently being expanded, for recursive-struct detection. */
  readonly expanding: readonly string[];
}

function lookupStruct(name: string, scope: Scope): VariableDeclaration[] | null {
  const local = scope.local.structs.get(name);
  if (local) return local[0] ?? [];
  const global = scope.global.index.structs.get(name);
  if (!global) return null;
  return global[0] ?? [];
}

function isDeclared(name: string, scope: Scope): boolean {
  return scope.local.kinds.has(name) || scope.global.index.kinds.has(name);
}

function isAmbiguous(name: string, scope: Scope): boolean {
  if (scope.local.kinds.has(name)) return false;
  return scope.global.ambiguous.has(name);
}

function declaredKinds(name: string, scope: Scope): Set<SymbolKind> | undefined {
  return scope.local.kinds.get(name) ?? scope.global.index.kinds.get(name);
}

function resolveUserDefinedType(namePath: string, scope: Scope): CanonicalType {
  const name = namePath.split(".").pop()?.trim() ?? "";
  if (!name) return { ok: false, reason: `empty user-defined type name "${namePath}"` };
  if (isAmbiguous(name, scope)) {
    return {
      ok: false,
      reason: `user-defined type "${name}" is declared with conflicting shapes and cannot be resolved safely`,
    };
  }
  if (!isDeclared(name, scope)) {
    return {
      ok: false,
      reason: `unknown user-defined type "${name}" cannot be resolved without compilation`,
    };
  }

  const kinds = declaredKinds(name, scope)!;
  if (kinds.has("contract")) return { ok: true, type: "address" };
  if (kinds.has("enum")) {
    // Solidity ABI-encodes every enum as uint8 (enums are capped at 256 members).
    return { ok: true, type: "uint8" };
  }
  if (kinds.has("valuetype")) {
    const definitions =
      scope.local.valueTypes.get(name) ?? scope.global.index.valueTypes.get(name) ?? [];
    const underlying = definitions[0];
    if (!underlying) {
      return { ok: false, reason: `user-defined value type "${name}" has no underlying type` };
    }
    const canonical = canonicalElementary(underlying);
    return canonical
      ? { ok: true, type: canonical }
      : {
          ok: false,
          reason: `user-defined value type "${name}" has an unsupported underlying type`,
        };
  }
  if (kinds.has("struct")) {
    if (scope.expanding.includes(name)) {
      return {
        ok: false,
        reason: `struct "${name}" is recursive and cannot be represented as an ABI tuple`,
      };
    }
    const members = lookupStruct(name, scope);
    if (!members) {
      return { ok: false, reason: `struct "${name}" has no resolvable definition` };
    }
    const types: string[] = [];
    for (const member of members) {
      const canonical = canonicalType(member.typeName, {
        ...scope,
        expanding: [...scope.expanding, name],
      });
      if (!canonical.ok) {
        return {
          ok: false,
          reason: `struct "${name}" member${member.name ? ` "${member.name}"` : ""}: ${canonical.reason}`,
        };
      }
      types.push(canonical.type);
    }
    return { ok: true, type: `(${types.join(",")})` };
  }

  return { ok: false, reason: `unsupported user-defined type "${name}"` };
}

export function canonicalType(typeName: TypeName | null, scope?: Scope): CanonicalType {
  if (!typeName) {
    return { ok: false, reason: "parameter has no resolvable type name" };
  }

  switch (typeName.type) {
    case "ElementaryTypeName": {
      const type = canonicalElementary(typeName);
      return type
        ? { ok: true, type }
        : { ok: false, reason: `unsupported elementary type "${typeName.name}"` };
    }
    case "ArrayTypeName":
      return canonicalArrayType(typeName, scope);
    case "UserDefinedTypeName":
      if (!scope) {
        return {
          ok: false,
          reason: `user-defined type "${typeName.namePath}" requires compiler-level symbol resolution`,
        };
      }
      return resolveUserDefinedType(typeName.namePath, scope);
    case "Mapping":
      return { ok: false, reason: "mapping types cannot appear in an ABI signature" };
    case "FunctionTypeName":
      return { ok: false, reason: "function types are not supported by this extractor" };
  }
}

function canonicalArrayType(node: ArrayTypeName, scope?: Scope): CanonicalType {
  const base = canonicalType(node.baseTypeName, scope);
  if (!base.ok) return base;

  if (node.length === null) return { ok: true, type: `${base.type}[]` };

  if (node.length.type !== "NumberLiteral") {
    return {
      ok: false,
      reason: "array length is not a numeric literal and cannot be resolved without compilation",
    };
  }

  const length = node.length.number.trim();
  if (!/^[1-9][0-9]*$/.test(length)) {
    return { ok: false, reason: `array length "${length}" is not a positive integer literal` };
  }

  return { ok: true, type: `${base.type}[${length}]` };
}

interface ParameterList {
  ok: true;
  types: string[];
}

interface ParameterFailure {
  ok: false;
  reason: string;
}

function canonicalParameters(
  parameters: readonly VariableDeclaration[],
  scope: Scope,
): ParameterList | ParameterFailure {
  const types: string[] = [];
  for (const parameter of parameters) {
    const canonical = canonicalType(parameter.typeName, scope);
    if (!canonical.ok) {
      const name = parameter.name ? ` "${parameter.name}"` : "";
      return { ok: false, reason: `parameter${name}: ${canonical.reason}` };
    }
    types.push(canonical.type);
  }
  return { ok: true, types };
}

function isCallable(functionDefinition: FunctionDefinition): boolean {
  if (!functionDefinition.name || functionDefinition.isConstructor) return false;
  if (functionDefinition.isFallback || functionDefinition.isReceiveEther) return false;
  return functionDefinition.visibility === "external" || functionDefinition.visibility === "public";
}

function declarationLabel(name: string | null, fallback: string): string {
  return name && name.trim() ? name.trim() : fallback;
}

interface ExtractContext {
  readonly source: ExtractionSource;
  readonly filePath: string;
  readonly scope: Scope;
  readonly functions: FunctionDraft[];
  readonly events: EventDraft[];
  readonly rejections: Rejection[];
}

function extractNode(node: ASTNode, context: ExtractContext): void {
  if (node.type === "FunctionDefinition" && isCallable(node)) {
    const parameters = canonicalParameters(node.parameters, context.scope);
    if (!parameters.ok) {
      context.rejections.push({
        filePath: context.filePath,
        kind: "function",
        declaration: declarationLabel(node.name, "function"),
        reason: parameters.reason,
      });
    } else {
      const signature = `${node.name}(${parameters.types.join(",")})`;
      const line = node.loc?.start.line ?? 0;
      try {
        context.functions.push({
          kind: "function",
          selector: toFunctionSelector(`function ${signature}`),
          signature,
          source: context.source.repo,
          sourceId: `${context.source.commitSha}:${context.filePath}:${line}:${signature}`,
        });
      } catch (error) {
        context.rejections.push({
          filePath: context.filePath,
          kind: "function",
          declaration: declarationLabel(node.name, "function"),
          reason: `selector computation failed: ${error instanceof Error ? error.message : "unknown error"}`,
        });
      }
    }
  }

  if (node.type === "EventDefinition") {
    const event = node as EventDefinition;
    const parameters = canonicalParameters(event.parameters, context.scope);
    if (!parameters.ok) {
      context.rejections.push({
        filePath: context.filePath,
        kind: "event",
        declaration: declarationLabel(event.name, "event"),
        reason: parameters.reason,
      });
    } else {
      const signature = `${event.name}(${parameters.types.join(",")})`;
      const line = event.loc?.start.line ?? 0;
      try {
        context.events.push({
          kind: "event",
          topic0: toEventSelector(`event ${signature}`),
          signature,
          source: context.source.repo,
          sourceId: `${context.source.commitSha}:${context.filePath}:${line}:${signature}`,
        });
      } catch (error) {
        context.rejections.push({
          filePath: context.filePath,
          kind: "event",
          declaration: declarationLabel(event.name, "event"),
          reason: `topic0 computation failed: ${error instanceof Error ? error.message : "unknown error"}`,
        });
      }
    }
  }

  for (const value of Object.values(node)) {
    if (Array.isArray(value)) {
      for (const child of value) {
        if (child && typeof child === "object") extractNode(child as ASTNode, context);
      }
    } else if (value && typeof value === "object") {
      extractNode(value as ASTNode, context);
    }
  }
}

function extractAst(
  ast: ASTNode,
  filePath: string,
  source: ExtractionSource,
  global: SymbolTable,
  local: SymbolIndex,
): { functions: FunctionDraft[]; events: EventDraft[]; rejections: Rejection[] } {
  const context: ExtractContext = {
    source,
    filePath,
    scope: { global, local, expanding: [] },
    functions: [],
    events: [],
    rejections: [],
  };
  extractNode(ast, context);
  return { functions: context.functions, events: context.events, rejections: context.rejections };
}

export interface ParsedSourceFile {
  readonly path: string;
  readonly content: string;
}

function parseOrReject(
  filePath: string,
  content: string,
): { ast: ASTNode; rejection?: undefined } | { ast?: undefined; rejection: Rejection } {
  try {
    return { ast: parse(content, { loc: true, range: false }) };
  } catch (error) {
    return {
      rejection: {
        filePath,
        kind: "file",
        declaration: filePath,
        reason: error instanceof Error ? error.message : "unknown parser failure",
      },
    };
  }
}

/** Extracts from a project, resolving types declared in any of its files. */
export function extractProject(
  files: readonly ParsedSourceFile[],
  source: ExtractionSource,
): ExtractionResult {
  const parsed: { path: string; ast: ASTNode }[] = [];
  const rejections: Rejection[] = [];

  for (const file of files) {
    const result = parseOrReject(file.path, file.content);
    if (result.rejection) rejections.push(result.rejection);
    else parsed.push({ path: file.path, ast: result.ast });
  }

  const global = buildSymbolTable(parsed.map((entry) => entry.ast));
  const functions: FunctionDraft[] = [];
  const events: EventDraft[] = [];

  for (const entry of parsed) {
    const local = collectLocalSymbols(entry.ast);
    const result = extractAst(entry.ast, entry.path, source, global, local);
    functions.push(...result.functions);
    events.push(...result.events);
    rejections.push(...result.rejections);
  }

  return { functions, events, rejections };
}

/** Extracts one file. Cross-file types resolve only when `symbols` is provided. */
export function extractFromSolidity(
  content: string,
  filePath: string,
  source: ExtractionSource,
  symbols?: SymbolTable,
): ExtractionResult {
  const result = parseOrReject(filePath, content);
  if (result.rejection) {
    return { functions: [], events: [], rejections: [result.rejection] };
  }
  const local = collectLocalSymbols(result.ast);
  return extractAst(result.ast, filePath, source, symbols ?? buildSymbolTable([result.ast]), local);
}

export type { EventDefinition, FunctionDefinition };
