import type { RequestHandler } from "express";
import { getRouteParam } from "../../utils/route.param.js";
import * as service from "./usage.service.js";

export const getProjectUsage: RequestHandler = async (req, res) =>
  res.json({
    success: true,
    data: await service.getProjectUsage(
      req.user!.id,
      getRouteParam(req.params.projectId, "projectId"),
    ),
  });
