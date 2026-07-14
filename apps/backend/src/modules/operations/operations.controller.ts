import type { RequestHandler } from "express";
import * as service from "./operations.service.js";

export const health: RequestHandler = (_req, res) =>
  res.json({
    success: true,
    data: service.getHealthStatus(),
  });

export const readiness: RequestHandler = async (_req, res) =>
  res.json({
    success: true,
    data: await service.getReadinessStatus(),
  });
