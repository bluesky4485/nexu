import "./datadog.js";
import { serve } from "@hono/node-server";
import { createApp } from "./app.js";
import { migrate } from "./db/migrate.js";
import { BaseError } from "./lib/error.js";
import { logger } from "./lib/logger.js";

async function main() {
  await migrate();

  if (process.env.AUTO_SEED === "true") {
    const { seedDev } = await import("./db/seed-dev.js");
    await seedDev();
  }

  const app = createApp();
  const port = Number.parseInt(process.env.PORT ?? "3000", 10);

  serve({ fetch: app.fetch, port }, (info) => {
    logger.info({
      message: "server_started",
      port: info.port,
    });
  });
}

main().catch((err) => {
  const baseError = BaseError.from(err);
  logger.error({
    message: "server_start_failed",
    ...baseError.toJSON(),
  });
});
