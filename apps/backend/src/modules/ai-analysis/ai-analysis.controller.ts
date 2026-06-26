import type { RequestHandler } from "express";
import { ApiError } from "../../utils/api-error.js";
import * as service from "./ai-analysis.service.js";

function getParam(value: string | string[] | undefined, name: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new ApiError(400, `Invalid ${name}`);
  }

  return value;
}

export const analyze: RequestHandler = async (req, res) => {
  const requirementId = getParam(req.params.requirementId, "requirementId");

  const data = await service.analyzeRequirement(
    req.user!.id,
    requirementId,
    Boolean(req.body.force),
  );

  res.status(201).json({
    success: true,
    data,
  });
};

export const list: RequestHandler = async (req, res) => {
  const requirementId = getParam(req.params.requirementId, "requirementId");

  res.json({
    success: true,
    data: {
      analyses: await service.listAnalyses(req.user!.id, requirementId),
    },
  });
};

export const getOne: RequestHandler = async (req, res) => {
  const analysisId = getParam(req.params.analysisId, "analysisId");

  res.json({
    success: true,
    data: {
      analysis: await service.getAnalysis(req.user!.id, analysisId),
    },
  });
};