import { Router } from "express";
import { requireAuth } from "../../middlewares/auth.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { asyncHandler } from "../../utils/async-handler.js";
import * as controller from "./sprint.controller.js";
import { createSprintSchema, listSprintsSchema, sprintTaskSchema, updateSprintSchema } from "./sprint.schema.js";

export const sprintRouter = Router();
sprintRouter.use(requireAuth);
sprintRouter.post("/projects/:projectId/sprints", validate(createSprintSchema), asyncHandler(controller.create));
sprintRouter.get("/projects/:projectId/sprints", validate(listSprintsSchema), asyncHandler(controller.list));
sprintRouter.patch("/sprints/:sprintId", validate(updateSprintSchema), asyncHandler(controller.update));
sprintRouter.post("/sprints/:sprintId/tasks/:taskId", validate(sprintTaskSchema), asyncHandler(controller.addTask));
sprintRouter.delete("/sprints/:sprintId/tasks/:taskId", validate(sprintTaskSchema), asyncHandler(controller.removeTask));
