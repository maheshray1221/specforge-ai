import type { RequestHandler } from "express";
import { getRouteParam } from "../../utils/route.param.js";
import * as service from "./ai-job.service.js";

export const getOne: RequestHandler = async (req, res) =>
  res.json({
    success: true,
    data: {
      job: await service.getAIJob(req.user!.id, getRouteParam(req.params.jobId, "jobId")),
    },
  });

export const listForProject: RequestHandler = async (req, res) =>
  res.json({
    success: true,
    data: await service.listProjectAIJobs(
      req.user!.id,
      getRouteParam(req.params.projectId, "projectId"),
      req.query as never,
    ),
  });
