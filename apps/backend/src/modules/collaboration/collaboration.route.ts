import { Router } from "express";
import { requireAuth } from "../../middlewares/auth.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { asyncHandler } from "../../utils/async-handler.js";
import * as controller from "./collaboration.controller.js";
import { createTaskCommentSchema, listProjectActivitySchema, listTaskCommentsSchema } from "./collaboration.schema.js";

export const collaborationRouter = Router();
collaborationRouter.use(requireAuth);

collaborationRouter.get("/tasks/:taskId/comments", validate(listTaskCommentsSchema), asyncHandler(controller.listTaskComments));
collaborationRouter.post("/tasks/:taskId/comments", validate(createTaskCommentSchema), asyncHandler(controller.createTaskComment));
collaborationRouter.get("/projects/:projectId/activity", validate(listProjectActivitySchema), asyncHandler(controller.listProjectActivity));
