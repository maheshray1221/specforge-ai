import { Router } from "express";
import { requireAuth } from "../../middlewares/auth.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { asyncHandler } from "../../utils/async-handler.js";
import * as controller from "./project.controller.js";
import { createProjectSchema, listProjectsSchema, projectIdSchema, updateProjectSchema } from "./project.schema.js";

export const projectRouter = Router();
projectRouter.use(requireAuth);
projectRouter.post("/", validate(createProjectSchema), asyncHandler(controller.create));
projectRouter.get("/", validate(listProjectsSchema), asyncHandler(controller.list));
projectRouter.get("/:projectId", validate(projectIdSchema), asyncHandler(controller.getOne));
projectRouter.patch("/:projectId", validate(updateProjectSchema), asyncHandler(controller.update));
projectRouter.delete("/:projectId", validate(projectIdSchema), asyncHandler(controller.archive));
