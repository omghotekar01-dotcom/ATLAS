import { expect, it } from "vitest";
import { createApp } from "./app-factory.js";
import { registerStudio } from "./studio.js";
import { makeDependencies } from "./test-support.js";

it("serves Studio pages and assets alongside JSON API routes", async () => {
  const app = createApp({ dependencies: makeDependencies(), rateLimitPerMinute: 0 });
  registerStudio(app, {
    "index.html": Buffer.from("<main>ATLAS Studio</main>").toString("base64"),
    "assets/index-abc.js": Buffer.from("export {};").toString("base64"),
  });
  try {
    for (const url of ["/", "/studio", "/studio/", "/developers", "/explorer", "/settings/"]) {
      const page = await app.inject({ url });
      expect(page.statusCode, url).toBe(200);
      expect(page.headers["content-type"]).toMatch(/^text\/html/);
    }
    const asset = await app.inject({ url: "/assets/index-abc.js" });
    expect(asset.body).toBe("export {};");
    expect(asset.headers["cache-control"]).toContain("immutable");

    const health = await app.inject({ url: "/health" });
    expect(health.statusCode).toBe(200);
    expect(health.headers["content-type"]).toMatch(/^application\/json/);
    const missing = await app.inject({ url: "/v1/unknown" });
    expect(missing.statusCode).toBe(404);
    expect(missing.json().error.code).toBe("NOT_FOUND");
  } finally {
    await app.close();
  }
});
