import { Router } from "express";
import { requireAuth } from "../../middlewares/auth.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { asyncHandler } from "../../utils/async-handler.js";
import * as controller from "./ai-analysis.controller.js";
import { analysisIdSchema, analyzeRequirementSchema, requirementAnalysisListSchema } from "./ai-analysis.schema.js";

export const aiAnalysisRouter = Router();
aiAnalysisRouter.use(requireAuth);
aiAnalysisRouter.post("/requirements/:requirementId/analyze", validate(analyzeRequirementSchema), asyncHandler(controller.analyze));
aiAnalysisRouter.get("/requirements/:requirementId/analyses", validate(requirementAnalysisListSchema), asyncHandler(controller.list));
aiAnalysisRouter.get("/analyses/:analysisId", validate(analysisIdSchema), asyncHandler(controller.getOne));
