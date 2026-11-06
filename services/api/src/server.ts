import Fastify from "fastify";

import { createApp } from "./app-factory.js";
import { registerStudio } from "./studio.js";

const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? "0.0.0.0";

const app = createApp({
  logger: process.env.ATLAS_LOG_LEVEL !== "silent",
  fastifyFactory: Fastify,
});

registerStudio(app);

// Ensure plugins and routing are registered before Vercel accepts requests.
// The default export is a real Node.js HTTP Server, not the Fastify factory.
await app.ready();
export default app.server;

// Vercel manages the server socket. Listening here would compete with its
// serverless runtime; local node/tsx startup still binds to PORT as before.
if (!process.env.VERCEL) {
  try {
    await app.listen({ port, host });
  } catch (error) {
    app.log.error(error);
    process.exitCode = 1;
  }

  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.once(signal, () => {
      void app.close().finally(() => process.exit(0));
    });
  }
}
