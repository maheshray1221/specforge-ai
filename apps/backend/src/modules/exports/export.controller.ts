import type { RequestHandler } from "express";
import { getRouteParam } from "../../utils/route.param.js";
import * as service from "./export.service.js";

export const exportProjectTasksCsv: RequestHandler = async (req, res) => {
  const csv = await service.exportProjectTasksCsv(
    req.user!.id,
    getRouteParam(req.params.projectId, "projectId"),
    req.query as never,
  );

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="specforge-tasks-${req.params.projectId}.csv"`);
  res.send(csv);
};
