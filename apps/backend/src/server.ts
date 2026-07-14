import { env } from "./config/env.js";
import { prisma } from "./config/prisma.js";
import { logger } from "./lib/logger.js";
import { captureException, flushMonitoring } from "./lib/monitoring.js";
import { app } from "./app.js";

const server = app.listen(env.PORT, () => {
  logger.info({ port: env.PORT, environment: env.NODE_ENV }, "SpecForge API started");
});

const shutdown = async (signal: string) => {
  logger.info({ signal }, "Shutting down");
  server.close(async () => {
    await flushMonitoring();
    await prisma.$disconnect();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
};

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));

process.on("unhandledRejection", (reason) => {
  logger.error({ reason }, "Unhandled promise rejection");
  captureException(reason, { tags: { source: "unhandledRejection" } });
});

process.on("uncaughtException", (error) => {
  logger.fatal({ err: error }, "Uncaught exception");
  captureException(error, { tags: { source: "uncaughtException" } });
  void shutdown("uncaughtException");
});
