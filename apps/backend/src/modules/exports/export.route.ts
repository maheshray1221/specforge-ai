import { Router } from "express";
import { requireAuth } from "../../middlewares/auth.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { asyncHandler } from "../../utils/async-handler.js";
import * as controller from "./export.controller.js";
import { exportProjectTasksSchema } from "./export.schema.js";

export const exportRouter = Router();
exportRouter.use(requireAuth);

exportRouter.get("/projects/:projectId/exports/tasks.csv", validate(exportProjectTasksSchema), asyncHandler(controller.exportProjectTasksCsv));
