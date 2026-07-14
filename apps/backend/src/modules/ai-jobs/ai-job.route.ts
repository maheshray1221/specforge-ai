import { Router } from "express";
import { requireAuth } from "../../middlewares/auth.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { asyncHandler } from "../../utils/async-handler.js";
import * as controller from "./ai-job.controller.js";
import { aiJobIdSchema, listProjectAIJobsSchema } from "./ai-job.schema.js";

export const aiJobRouter = Router();
aiJobRouter.use(requireAuth);

aiJobRouter.get("/ai-jobs/:jobId", validate(aiJobIdSchema), asyncHandler(controller.getOne));
aiJobRouter.get("/projects/:projectId/ai-jobs", validate(listProjectAIJobsSchema), asyncHandler(controller.listForProject));
