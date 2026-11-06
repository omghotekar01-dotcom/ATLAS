import { afterEach, describe, expect, it } from "vitest";

import { createApp, type CreateAppOptions } from "./app-factory.js";
import {
  DEV_CORS_ORIGINS,
  isAllowedOrigin,
  normalizeOrigin,
  parseCorsOriginList,
  resolveCorsPolicy,
} from "./cors.js";
import { makeDependencies } from "./test-support.js";

const FUNCTION_PATH = "/v1/functions/0x9010d07c";

type TestApp = ReturnType<typeof createApp>;
const openApps: TestApp[] = [];

function makeApp(
  options: { rateLimitPerMinute?: number; cors?: CreateAppOptions["cors"] } = {},
): TestApp {
  const app = createApp({
    dependencies: makeDependencies(),
    rateLimitPerMinute: options.rateLimitPerMinute ?? 0,
    upstreamTimeoutMs: 2_000,
    cors: options.cors ?? { env: {} },
  });
  openApps.push(app);
  return app;
}

afterEach(async () => {
  while (openApps.length > 0) await openApps.pop()!.close();
});

function preflight(app: TestApp, origin: string, path = FUNCTION_PATH) {
  return app.inject({
    method: "OPTIONS",
    url: path,
    headers: {
      origin,
      "access-control-request-method": "GET",
      "access-control-request-headers": "content-type,accept",
    },
  });
}

describe("CORS policy resolution", () => {
  it("allows the four development origins by default", () => {
    expect(DEV_CORS_ORIGINS).toEqual([
      "http://localhost:5173",
      "http://127.0.0.1:5173",
      "http://localhost:4173",
      "http://127.0.0.1:4173",
    ]);
    const policy = resolveCorsPolicy({ env: {} });
    for (const origin of DEV_CORS_ORIGINS) {
      expect(isAllowedOrigin(origin, policy)).toBe(true);
    }
  });

  it("adds production origins from ATLAS_CORS_ORIGINS", () => {
    const policy = resolveCorsPolicy({
      env: { ATLAS_CORS_ORIGINS: "https://studio.example.com, https://atlas.example.org/" },
    });
    expect(isAllowedOrigin("https://studio.example.com", policy)).toBe(true);
    expect(isAllowedOrigin("https://atlas.example.org", policy)).toBe(true);
    expect(isAllowedOrigin("http://localhost:5173", policy)).toBe(true);
  });

  it("drops the development origins when ATLAS_CORS_DEV_ORIGINS=false", () => {
    const policy = resolveCorsPolicy({
      env: {
        ATLAS_CORS_DEV_ORIGINS: "false",
        ATLAS_CORS_ORIGINS: "https://studio.example.com",
      },
    });
    expect(policy.allowedOrigins).toEqual(["https://studio.example.com"]);
    expect(isAllowedOrigin("http://localhost:5173", policy)).toBe(false);
  });

  it("rejects wildcards, paths, credentials and non-http schemes at startup", () => {
    expect(() => normalizeOrigin("*")).toThrow(/wildcards/);
    expect(() => normalizeOrigin("https://*.example.com")).toThrow(/wildcards/);
    expect(() => normalizeOrigin("https://studio.example.com/app")).toThrow(/bare origin/);
    expect(() => normalizeOrigin("https://user:password@studio.example.com")).toThrow(
      /bare origin/,
    );
    expect(() => normalizeOrigin("https://studio.example.com?x=1")).toThrow(/bare origin/);
    expect(() => normalizeOrigin("ftp://studio.example.com")).toThrow(/http or https/);
    expect(() => normalizeOrigin("not a url")).toThrow(/not a valid URL origin/);
    expect(() =>
      resolveCorsPolicy({ env: { ATLAS_CORS_ORIGINS: "https://ok.example.com,*" } }),
    ).toThrow(/wildcards/);
  });

  it("parses an empty or missing list as no extra origins", () => {
    expect(parseCorsOriginList(undefined)).toEqual([]);
    expect(parseCorsOriginList("  ")).toEqual([]);
    expect(parseCorsOriginList(" , ")).toEqual([]);
  });

  it("never allows an origin that merely starts with an approved one", () => {
    const policy = resolveCorsPolicy({ env: {} });
    expect(isAllowedOrigin("http://localhost:5173.evil.example", policy)).toBe(false);
    expect(isAllowedOrigin("http://localhost:51730", policy)).toBe(false);
    expect(isAllowedOrigin("https://localhost:5173", policy)).toBe(false);
    expect(isAllowedOrigin(undefined, policy)).toBe(false);
  });
});

describe("CORS headers on the API", () => {
  it.each(DEV_CORS_ORIGINS)("echoes the exact approved origin %s on GET", async (origin) => {
    const app = makeApp();
    const response = await app.inject({ method: "GET", url: FUNCTION_PATH, headers: { origin } });

    expect(response.statusCode).toBe(200);
    expect(response.headers["access-control-allow-origin"]).toBe(origin);
    expect(response.headers["access-control-allow-credentials"]).toBeUndefined();
    expect(response.headers.vary).toContain("Origin");
    expect(response.headers["access-control-expose-headers"]).toContain("X-Request-Id");
  });

  it.each(DEV_CORS_ORIGINS)(
    "answers the preflight for %s with 204 and the exact origin",
    async (origin) => {
      const app = makeApp();
      const response = await preflight(app, origin);

      expect(response.statusCode).toBe(204);
      expect(response.headers["access-control-allow-origin"]).toBe(origin);
      const methods = String(response.headers["access-control-allow-methods"])
        .split(",")
        .map((method) => method.trim());
      expect(methods.sort()).toEqual(["GET", "HEAD", "OPTIONS", "POST"]);
      expect(response.headers["access-control-allow-headers"]).toMatch(/Content-Type/i);
      expect(response.headers["access-control-allow-headers"]).toMatch(/Accept/i);
      expect(response.headers["access-control-max-age"]).toBe("600");
      expect(response.headers["access-control-allow-credentials"]).toBeUndefined();
    },
  );

  it("supports POST preflight for the decode endpoints", async () => {
    const app = makeApp();
    const response = await app.inject({
      method: "OPTIONS",
      url: "/v1/decode/calldata",
      headers: {
        origin: "http://localhost:5173",
        "access-control-request-method": "POST",
        "access-control-request-headers": "content-type",
      },
    });
    expect(response.statusCode).toBe(204);
    expect(response.headers["access-control-allow-origin"]).toBe("http://localhost:5173");
  });

  it("supports a cross-origin POST with a JSON body", async () => {
    const app = makeApp();
    const response = await app.inject({
      method: "POST",
      url: "/v1/decode/calldata",
      headers: { origin: "http://127.0.0.1:5173", "content-type": "application/json" },
      payload: { calldata: "0x" },
    });
    expect(response.headers["access-control-allow-origin"]).toBe("http://127.0.0.1:5173");
  });

  it("serves a production origin from ATLAS_CORS_ORIGINS", async () => {
    const app = makeApp({
      cors: { env: { ATLAS_CORS_ORIGINS: "https://studio.example.com" } },
    });
    const response = await app.inject({
      method: "GET",
      url: FUNCTION_PATH,
      headers: { origin: "https://studio.example.com" },
    });
    expect(response.headers["access-control-allow-origin"]).toBe("https://studio.example.com");
  });

  it("rejects an unapproved origin: no allow-origin header on GET or preflight", async () => {
    const app = makeApp();
    const evil = "https://evil.example";

    const get = await app.inject({ method: "GET", url: FUNCTION_PATH, headers: { origin: evil } });
    expect(get.headers["access-control-allow-origin"]).toBeUndefined();
    expect(get.headers["access-control-allow-credentials"]).toBeUndefined();

    const pre = await preflight(app, evil);
    expect(pre.headers["access-control-allow-origin"]).toBeUndefined();
    expect(pre.headers["access-control-allow-credentials"]).toBeUndefined();
  });

  it("rejects near-miss origins (prefix, port and scheme variants)", async () => {
    const app = makeApp();
    for (const origin of [
      "http://localhost:5173.evil.example",
      "http://localhost:51730",
      "https://localhost:5173",
      "http://localhost:3000",
    ]) {
      const response = await app.inject({
        method: "GET",
        url: FUNCTION_PATH,
        headers: { origin },
      });
      expect(response.headers["access-control-allow-origin"]).toBeUndefined();
    }
  });

  it("sends no CORS headers for requests without an Origin (same-origin or server-to-server)", async () => {
    const app = makeApp();
    const response = await app.inject({ method: "GET", url: FUNCTION_PATH });
    expect(response.statusCode).toBe(200);
    expect(response.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("never emits a wildcard or a credentialed allow-origin, for any origin", async () => {
    const app = makeApp();
    for (const origin of [...DEV_CORS_ORIGINS, "https://evil.example"]) {
      const get = await app.inject({ method: "GET", url: FUNCTION_PATH, headers: { origin } });
      const pre = await preflight(app, origin);
      for (const response of [get, pre]) {
        expect(response.headers["access-control-allow-origin"]).not.toBe("*");
        expect(response.headers["access-control-allow-credentials"]).toBeUndefined();
      }
    }
  });

  it("keeps the CORS headers on a rate-limited (429) reply", async () => {
    const app = makeApp({ rateLimitPerMinute: 1 });
    const origin = "http://localhost:5173";

    const first = await app.inject({ method: "GET", url: FUNCTION_PATH, headers: { origin } });
    expect(first.statusCode).toBe(200);

    const limited = await app.inject({ method: "GET", url: FUNCTION_PATH, headers: { origin } });
    expect(limited.statusCode).toBe(429);
    expect(limited.headers["access-control-allow-origin"]).toBe(origin);
    expect(limited.headers["retry-after"]).toBeDefined();
  });

  it("does not spend rate budget on preflight requests", async () => {
    const app = makeApp({ rateLimitPerMinute: 1 });
    const origin = "http://localhost:5173";

    for (let index = 0; index < 3; index += 1) {
      const response = await preflight(app, origin);
      expect(response.statusCode).toBe(204);
    }
    const real = await app.inject({ method: "GET", url: FUNCTION_PATH, headers: { origin } });
    expect(real.statusCode).toBe(200);
  });

  it("exposes the request id so Studio can show it", async () => {
    const app = makeApp();
    const response = await app.inject({
      method: "GET",
      url: FUNCTION_PATH,
      headers: { origin: "http://localhost:5173", "x-request-id": "studio-check-1" },
    });
    expect(response.headers["x-request-id"]).toBe("studio-check-1");
    expect(response.headers["access-control-expose-headers"]).toContain("X-Request-Id");
  });
});
