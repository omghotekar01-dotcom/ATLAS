import { randomUUID } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { FastifyInstance } from "fastify";

import { createApp, type CreateAppOptions } from "./app.js";

export type VercelHandler = (request: IncomingMessage, response: ServerResponse) => Promise<void>;

function restoreFastifyPath(request: IncomingMessage): void {
  const url = request.url;
  if (!url) return;

  const queryIndex = url.indexOf("?");
  const pathname = queryIndex === -1 ? url : url.slice(0, queryIndex);
  if (pathname !== "/api" && !pathname.startsWith("/api/")) return;

  const query = queryIndex === -1 ? "" : url.slice(queryIndex);
  request.url = `${pathname.slice(4) || "/"}${query}`;
}

/**
 * Adapts the same Fastify app to the Vercel Node runtime without starting a
 * listener. The instance is created once per warm lambda and reused.
 *
 * `api/[...path].ts` at the deployment root only needs to export this handler:
 *
 *   export default createVercelHandler();
 *
 * Cold starts pay Fastify's `ready()` cost once; subsequent requests reuse the
 * app. No credentials are read at module import time.
 */
export function createVercelHandler(options: CreateAppOptions = {}): VercelHandler {
  let appPromise: Promise<FastifyInstance> | undefined;

  const app = () => {
    appPromise ??= (async () => {
      const instance = createApp(options);
      await instance.ready();
      return instance;
    })();
    return appPromise;
  };

  return async (request, response) => {
    try {
      const instance = await app();
      restoreFastifyPath(request);
      await new Promise<void>((resolve, reject) => {
        const finish = () => {
          response.off("finish", finish);
          response.off("close", finish);
          resolve();
        };
        response.once("finish", finish);
        response.once("close", finish);
        try {
          instance.server.emit("request", request, response);
        } catch (error) {
          response.off("finish", finish);
          response.off("close", finish);
          reject(error);
        }
      });
    } catch (error) {
      console.error(
        JSON.stringify({
          event: "atlas_api_handler_failure",
          errorType: error instanceof Error ? "Error" : "NonErrorThrown",
        }),
      );
      if (!response.headersSent && !response.destroyed) {
        const requestId = randomUUID();
        response.statusCode = 500;
        response.setHeader("content-type", "application/json; charset=utf-8");
        response.setHeader("cache-control", "no-store");
        response.setHeader("x-request-id", requestId);
        response.end(
          JSON.stringify({
            error: {
              code: "INTERNAL",
              message: "The service could not complete the request.",
              details: null,
              requestId,
            },
          }),
        );
      } else if (!response.writableEnded && !response.destroyed) {
        response.end();
      }
    }
  };
}
