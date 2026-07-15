import { Router } from "express";
import { requireAuth } from "../../middlewares/auth.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { asyncHandler } from "../../utils/async-handler.js";
import * as controller from "./collaboration.controller.js";
import {
  acceptProjectInvitationSchema,
  cancelProjectInvitationSchema,
  createProjectInvitationSchema,
  createTaskCommentSchema,
  listProjectActivitySchema,
  listProjectInvitationsSchema,
  listProjectMembersSchema,
  listTaskCommentsSchema,
  removeProjectMemberSchema,
  updateProjectMemberSchema,
} from "./collaboration.schema.js";

export const collaborationRouter = Router();
collaborationRouter.use(requireAuth);

collaborationRouter.get("/tasks/:taskId/comments", validate(listTaskCommentsSchema), asyncHandler(controller.listTaskComments));
collaborationRouter.post("/tasks/:taskId/comments", validate(createTaskCommentSchema), asyncHandler(controller.createTaskComment));
collaborationRouter.get("/projects/:projectId/activity", validate(listProjectActivitySchema), asyncHandler(controller.listProjectActivity));
collaborationRouter.get("/projects/:projectId/members", validate(listProjectMembersSchema), asyncHandler(controller.listProjectMembers));
collaborationRouter.patch("/projects/:projectId/members/:memberId", validate(updateProjectMemberSchema), asyncHandler(controller.updateProjectMember));
collaborationRouter.delete("/projects/:projectId/members/:memberId", validate(removeProjectMemberSchema), asyncHandler(controller.removeProjectMember));
collaborationRouter.get("/projects/:projectId/invitations", validate(listProjectInvitationsSchema), asyncHandler(controller.listProjectInvitations));
collaborationRouter.post("/projects/:projectId/invitations", validate(createProjectInvitationSchema), asyncHandler(controller.createProjectInvitation));
collaborationRouter.delete("/invitations/:invitationId", validate(cancelProjectInvitationSchema), asyncHandler(controller.cancelProjectInvitation));
collaborationRouter.post("/invitations/accept", validate(acceptProjectInvitationSchema), asyncHandler(controller.acceptProjectInvitation));
