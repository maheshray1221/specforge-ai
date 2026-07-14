import { Router } from "express";
import { requireAuth } from "../../middlewares/auth.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { asyncHandler } from "../../utils/async-handler.js";
import * as controller from "./analytics.controller.js";
import { analysisFeedbackSchema, projectAnalyticsSummarySchema, trackAnalyticsEventSchema } from "./analytics.schema.js";

export const analyticsRouter = Router();
analyticsRouter.use(requireAuth);

analyticsRouter.post("/analytics/events", validate(trackAnalyticsEventSchema), asyncHandler(controller.track));
analyticsRouter.get("/projects/:projectId/analytics/summary", validate(projectAnalyticsSummarySchema), asyncHandler(controller.projectSummary));
analyticsRouter.post("/analyses/:analysisId/feedback", validate(analysisFeedbackSchema), asyncHandler(controller.submitAnalysisFeedback));
