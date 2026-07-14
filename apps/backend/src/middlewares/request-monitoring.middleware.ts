import type { RequestHandler } from "express";
import { logger } from "../lib/logger.js";

const SLOW_REQUEST_THRESHOLD_MS = 1_000;

export const requestMonitoring: RequestHandler = (req, res, next) => {
  const startedAt = process.hrtime.bigint();

  res.on("finish", () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;

    if (durationMs >= SLOW_REQUEST_THRESHOLD_MS) {
      logger.warn(
        {
          durationMs: Math.round(durationMs),
          method: req.method,
          path: req.originalUrl,
          requestId: res.getHeader("x-request-id"),
          statusCode: res.statusCode,
        },
        "Slow request detected",
      );
    }
  });

  next();
};
