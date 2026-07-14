import type { RequestHandler } from "express";
import { getRouteParam } from "../../utils/route.param.js";
import * as service from "./analytics.service.js";

export const track: RequestHandler = async (req, res) =>
  res.status(201).json({
    success: true,
    data: {
      event: await service.trackAnalyticsEvent(req.user!.id, req.body),
    },
  });

export const projectSummary: RequestHandler = async (req, res) =>
  res.json({
    success: true,
    data: await service.getProjectAnalyticsSummary(
      req.user!.id,
      getRouteParam(req.params.projectId, "projectId"),
      Number(req.query.days ?? 30),
    ),
  });

export const submitAnalysisFeedback: RequestHandler = async (req, res) =>
  res.status(201).json({
    success: true,
    data: {
      event: await service.submitAnalysisFeedback(
        req.user!.id,
        getRouteParam(req.params.analysisId, "analysisId"),
        req.body,
      ),
    },
  });
