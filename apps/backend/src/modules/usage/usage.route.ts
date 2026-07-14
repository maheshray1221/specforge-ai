import { Router } from "express";
import { requireAuth } from "../../middlewares/auth.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { asyncHandler } from "../../utils/async-handler.js";
import * as controller from "./usage.controller.js";
import { projectUsageSchema } from "./usage.schema.js";

export const usageRouter = Router();
usageRouter.use(requireAuth);

usageRouter.get("/projects/:projectId/usage", validate(projectUsageSchema), asyncHandler(controller.getProjectUsage));
