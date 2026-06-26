import { Router } from "express";
import { requireAuth } from "../../middlewares/auth.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { asyncHandler } from "../../utils/async-handler.js";
import * as controller from "./task.controller.js";
import { generateTasksSchema, listTasksSchema, updateTaskSchema } from "./task.schema.js";

export const taskRouter = Router();
taskRouter.use(requireAuth);
taskRouter.post("/analyses/:analysisId/tasks/generate", validate(generateTasksSchema), asyncHandler(controller.generate));
taskRouter.get("/projects/:projectId/tasks", validate(listTasksSchema), asyncHandler(controller.list));
taskRouter.patch("/tasks/:taskId", validate(updateTaskSchema), asyncHandler(controller.update));
