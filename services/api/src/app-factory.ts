import { randomUUID } from "node:crypto";
import cors from "@fastify/cors";
import Fastify, { type FastifyInstance } from "fastify";
import fp from "fastify-plugin";
import { ZodError } from "zod";
import {
  AnalyzeTransactionRequestSchema,
  ApiErrorSchema,
  DecodeCalldataRequestSchema,
  DecodeLogsRequestSchema,
  HealthResponseSchema,
  InvalidInputError,
  presentAtlasError,
  RateLimitedError,
  AtlasError,
  toApiError,
  type ApiError,
} from "@atlas/schemas";
import {
  decodeCalldata,
  decodeLog,
  lookupEvent,
  lookupFunction,
  parseSearchLimit,
  searchFunctions,
} from "@atlas/core";

import {
  CORS_ALLOWED_HEADERS,
  CORS_ALLOWED_METHODS,
  CORS_EXPOSED_HEADERS,
  CORS_MAX_AGE_SECONDS,
  isAllowedOrigin,
  resolveCorsPolicy,
  type CorsPolicyOptions,
} from "./cors.js";
import { createDefaultDependencies, type ApiDependencies } from "./deps.js";
import { investigateTransaction } from "./transaction.js";
import { withTimeout } from "./timeout.js";

export interface CreateAppOptions {
  readonly dependencies?: ApiDependencies;
  readonly fastifyFactory?: typeof Fastify;
  readonly logger?: boolean;
  readonly rateLimitPerMinute?: number;
  readonly upstreamTimeoutMs?: number;
  /** Browser origin policy. Defaults to dev origins plus `ATLAS_CORS_ORIGINS`. */
  readonly cors?: CorsPolicyOptions;
}

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

function readPositiveInteger(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback;
}

function envelope(error: AtlasError, requestId: string): ApiError {
  return ApiErrorSchema.parse(toApiError(error, requestId));
}

function parseLimit(value: unknown): number | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || value.trim() === "") {
    throw new InvalidInputError("limit must be an integer.");
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) throw new InvalidInputError("limit must be an integer.");
  return parsed;
}

export function createApp(options: CreateAppOptions = {}): FastifyInstance {
  const dependencies = options.dependencies ?? createDefaultDependencies();
  const rateLimitPerMinute =
    options.rateLimitPerMinute ?? readPositiveInteger(process.env.ATLAS_RATE_LIMIT_PER_MINUTE, 120);
  const upstreamTimeoutMs =
    options.upstreamTimeoutMs ?? readPositiveInteger(process.env.ATLAS_UPSTREAM_TIMEOUT_MS, 8_000);

  const app = (options.fastifyFactory ?? Fastify)({
    logger: options.logger ?? false,
    genReqId: (request) => {
      const header = request.headers["x-request-id"];
      const supplied = Array.isArray(header) ? header[0] : header;
      return supplied && supplied.trim().length > 0 ? supplied.trim() : randomUUID();
    },
  });

  // Explicit allowlist, exact-match only. Never a wildcard, and credentials stay off.
  const corsPolicy = resolveCorsPolicy(options.cors);
  app.register(cors, {
    origin: (origin, callback) => {
      // No Origin header means a same-origin or non-browser client: no CORS headers needed.
      if (!origin) return callback(null, false);
      callback(null, isAllowedOrigin(origin, corsPolicy) ? origin : false);
    },
    methods: [...CORS_ALLOWED_METHODS],
    allowedHeaders: [...CORS_ALLOWED_HEADERS],
    exposedHeaders: [...CORS_EXPOSED_HEADERS],
    credentials: false,
    maxAge: CORS_MAX_AGE_SECONDS,
    strictPreflight: true,
  });

  const buckets = new Map<string, RateLimitEntry>();

  // Registered after CORS on purpose. Plugins load in registration order, so the
  // CORS onRequest hook runs first and every reply, including a 429, carries
  // the approved Access-Control-Allow-Origin header. Without this order a
  // rate-limited browser request reads as a network failure.
  app.register(
    fp(
      async (instance) => {
        instance.addHook("onRequest", async (request, reply) => {
          reply.header("x-request-id", request.id);
          // Preflight answers are not billed against the client's budget.
          if (request.method === "OPTIONS") return;
          if (!request.url.startsWith("/v1/") || rateLimitPerMinute <= 0) return;

          const now = Date.now();
          if (buckets.size > 10_000) {
            for (const [key, entry] of buckets) {
              if (entry.resetAt <= now) buckets.delete(key);
            }
          }

          const key = request.ip;
          const current = buckets.get(key);
          if (!current || current.resetAt <= now) {
            buckets.set(key, { count: 1, resetAt: now + 60_000 });
            reply.header("x-ratelimit-limit", String(rateLimitPerMinute));
            reply.header("x-ratelimit-remaining", String(rateLimitPerMinute - 1));
            return;
          }

          current.count += 1;
          if (current.count > rateLimitPerMinute) {
            reply.header("retry-after", String(Math.ceil((current.resetAt - now) / 1000)));
            throw new RateLimitedError(
              `Rate limit exceeded: ${rateLimitPerMinute} requests per minute per client.`,
              { limit: rateLimitPerMinute },
            );
          }
          reply.header("x-ratelimit-limit", String(rateLimitPerMinute));
          reply.header("x-ratelimit-remaining", String(rateLimitPerMinute - current.count));
        });
      },
      { name: "atlas-request-policy" },
    ),
  );

  app.setErrorHandler((error: unknown, request, reply) => {
    const fastifyError = error as {
      statusCode?: number;
      validation?: { instancePath: string; message?: string }[];
    };
    if (error instanceof AtlasError) {
      return reply.code(presentAtlasError(error).httpStatus).send(envelope(error, request.id));
    }

    if (error instanceof ZodError) {
      const invalid = new InvalidInputError("Request validation failed.");
      const payload = envelope(invalid, request.id);
      payload.error.details = {
        issues: error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      };
      return reply.code(400).send(payload);
    }

    if (fastifyError.validation) {
      const invalid = new InvalidInputError("Request validation failed.");
      const payload = envelope(invalid, request.id);
      payload.error.details = {
        issues: fastifyError.validation.map((issue) => ({
          path: issue.instancePath,
          message: issue.message ?? "invalid value",
        })),
      };
      return reply.code(400).send(payload);
    }

    const status = fastifyError.statusCode ?? 500;
    if (status >= 400 && status < 500) {
      return reply
        .code(400)
        .send(envelope(new InvalidInputError("Malformed request."), request.id));
    }

    request.log.error(
      { errorType: error instanceof Error ? "Error" : "NonErrorThrown" },
      "unhandled request failure",
    );
    return reply
      .code(500)
      .send(
        envelope(
          new AtlasError("INTERNAL", "The service encountered an unexpected internal error."),
          request.id,
        ),
      );
  });

  app.setNotFoundHandler((request, reply) => {
    const notFound = new AtlasError("NOT_FOUND", "No route matches this request.");
    return reply.code(404).send(envelope(notFound, request.id));
  });

  app.get("/health", async () => {
    // Health is a liveness surface: an upstream failure is reported as
    // degraded with 200, never as a false success or an unhandled 500.
    const connected = await withTimeout(
      dependencies.health(),
      upstreamTimeoutMs,
      "The upstream health probe timed out.",
    )
      .then((health) => health.arkiv.connected)
      .catch(() => false);
    return HealthResponseSchema.parse({
      status: connected ? "ok" : "degraded",
      version: dependencies.version,
      arkiv: { connected },
    });
  });

  app.get("/v1/functions/search", async (request) => {
    const query = request.query as Record<string, string | undefined>;
    const search = query.q?.trim() ?? "";
    if (!search) throw new InvalidInputError("q is required.", "INVALID_INPUT");

    return withTimeout(
      searchFunctions(dependencies.functions, search, {
        limit: parseSearchLimit(parseLimit(query.limit)),
        ...(query.cursor ? { cursor: query.cursor } : {}),
      }),
      upstreamTimeoutMs,
      "Signature search timed out.",
    );
  });

  app.get("/v1/functions/:selector", async (request) => {
    const { selector } = request.params as { selector?: string };
    if (!selector) throw new InvalidInputError("A selector path parameter is required.");
    return withTimeout(
      lookupFunction(dependencies.functions, selector),
      upstreamTimeoutMs,
      "Signature lookup timed out.",
    );
  });

  app.post("/v1/decode/calldata", async (request) => {
    const body = DecodeCalldataRequestSchema.parse(request.body);
    return withTimeout(
      decodeCalldata(dependencies.functions, body.calldata),
      upstreamTimeoutMs,
      "Calldata decoding timed out.",
    );
  });

  app.get("/v1/events/:topic0", async (request) => {
    const { topic0 } = request.params as { topic0?: string };
    if (!topic0) throw new InvalidInputError("A topic0 path parameter is required.");
    return withTimeout(
      lookupEvent(dependencies.events, topic0),
      upstreamTimeoutMs,
      "Event signature lookup timed out.",
    );
  });

  app.post("/v1/decode/logs", async (request) => {
    const body = DecodeLogsRequestSchema.parse(request.body);
    const results = await withTimeout(
      Promise.all(body.logs.map((log) => decodeLog(dependencies.events, log))),
      upstreamTimeoutMs,
      "Log decoding timed out.",
    );
    return { results };
  });

  app.post("/v1/transactions/analyze", async (request) => {
    const body = AnalyzeTransactionRequestSchema.parse(request.body);
    return withTimeout(
      investigateTransaction(dependencies, body.chainId, body.hash),
      upstreamTimeoutMs,
      "Transaction analysis timed out.",
    );
  });

  return app;
}
