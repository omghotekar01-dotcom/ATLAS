/**
 * Browser origin policy for the ATLAS API.
 *
 * - Only explicit origins are ever allowed. A wildcard is never returned, and
 *   credentials are never enabled, so `Access-Control-Allow-Origin` is always
 *   either one exact approved origin or absent.
 * - Development origins (the Vite dev and preview servers on localhost and
 *   127.0.0.1) are allowed by default.
 * - Production origins come from the server-side `ATLAS_CORS_ORIGINS`
 *   environment variable: a comma-separated list of exact origins such as
 *   `https://studio.example.com`. Set `ATLAS_CORS_DEV_ORIGINS=false` to drop
 *   the development defaults in production.
 */

export const DEV_CORS_ORIGINS = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:4173",
  "http://127.0.0.1:4173",
] as const;

export const CORS_ALLOWED_METHODS = ["GET", "HEAD", "POST", "OPTIONS"] as const;
export const CORS_ALLOWED_HEADERS = ["Accept", "Content-Type", "X-Request-Id"] as const;
export const CORS_EXPOSED_HEADERS = [
  "X-Request-Id",
  "X-RateLimit-Limit",
  "X-RateLimit-Remaining",
  "Retry-After",
] as const;
export const CORS_MAX_AGE_SECONDS = 600;

/**
 * Normalizes one configured origin to the exact `scheme://host[:port]` form a
 * browser sends in its `Origin` header. Rejects wildcards, paths, queries,
 * credentials and any non-http(s) scheme so a typo cannot widen the policy.
 */
export function normalizeOrigin(raw: string): string {
  const value = raw.trim();
  if (value === "*" || value.includes("*")) {
    throw new Error(`CORS origin "${value}" is not allowed: wildcards are never permitted.`);
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`CORS origin "${value}" is not a valid URL origin.`);
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(`CORS origin "${value}" must use http or https.`);
  }
  const bareOrigin = `${url.protocol}//${url.host}`;
  if (value !== bareOrigin && value !== `${bareOrigin}/`) {
    throw new Error(
      `CORS origin "${value}" must be a bare origin (scheme, host and optional port) with no path, query or credentials.`,
    );
  }
  return url.origin;
}

/** Parses a comma-separated `ATLAS_CORS_ORIGINS` value. Empty entries are ignored. */
export function parseCorsOriginList(value: string | undefined): string[] {
  if (!value || value.trim() === "") return [];
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
    .map(normalizeOrigin);
}

export interface CorsPolicy {
  /** Exact origins that receive `Access-Control-Allow-Origin`. */
  readonly allowedOrigins: readonly string[];
}

export interface CorsPolicyOptions {
  /** Extra production origins. Defaults to `ATLAS_CORS_ORIGINS`. */
  readonly origins?: readonly string[];
  /** Whether to include the development origins. Defaults to `ATLAS_CORS_DEV_ORIGINS` (true). */
  readonly includeDevOrigins?: boolean;
  readonly env?: NodeJS.ProcessEnv;
}

/** Builds the exact allowlist. Throws on any invalid configured origin. */
export function resolveCorsPolicy(options: CorsPolicyOptions = {}): CorsPolicy {
  const env = options.env ?? process.env;
  const includeDev =
    options.includeDevOrigins ?? env.ATLAS_CORS_DEV_ORIGINS?.trim().toLowerCase() !== "false";
  const configured = (options.origins ?? parseCorsOriginList(env.ATLAS_CORS_ORIGINS)).map(
    normalizeOrigin,
  );
  const allowed = [...(includeDev ? DEV_CORS_ORIGINS : []), ...configured];
  return { allowedOrigins: [...new Set(allowed)] };
}

/** Exact-match check. The request `Origin` must equal an allowlisted origin. */
export function isAllowedOrigin(origin: string | undefined, policy: CorsPolicy): boolean {
  if (!origin) return false;
  return policy.allowedOrigins.includes(origin);
}
