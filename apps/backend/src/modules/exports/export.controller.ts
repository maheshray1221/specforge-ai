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

export const exportProjectSprintsCsv: RequestHandler = async (req, res) => {
  const csv = await service.exportProjectSprintsCsv(
    req.user!.id,
    getRouteParam(req.params.projectId, "projectId"),
  );

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="specforge-sprints-${req.params.projectId}.csv"`);
  res.send(csv);
};

export const exportProjectPlanningJson: RequestHandler = async (req, res) => {
  const planningPackage = await service.exportProjectPlanningJson(
    req.user!.id,
    getRouteParam(req.params.projectId, "projectId"),
  );

  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="specforge-planning-${req.params.projectId}.json"`);
  res.json({
    success: true,
    data: planningPackage,
  });
};

export const exportProjectPlanningPdf: RequestHandler = async (req, res) => {
  const pdf = await service.exportProjectPlanningPdf(
    req.user!.id,
    getRouteParam(req.params.projectId, "projectId"),
  );

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="specforge-planning-${req.params.projectId}.pdf"`);
  res.send(pdf);
};
