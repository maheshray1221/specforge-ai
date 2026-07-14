import type { RequestHandler } from "express";
import { getRouteParam } from "../../utils/route.param.js";
import * as service from "./collaboration.service.js";

export const listTaskComments: RequestHandler = async (req, res) =>
  res.json({
    success: true,
    data: {
      comments: await service.listTaskComments(
        req.user!.id,
        getRouteParam(req.params.taskId, "taskId"),
      ),
    },
  });

export const createTaskComment: RequestHandler = async (req, res) =>
  res.status(201).json({
    success: true,
    data: {
      comment: await service.createTaskComment(
        req.user!.id,
        getRouteParam(req.params.taskId, "taskId"),
        req.body,
      ),
    },
  });

export const listProjectActivity: RequestHandler = async (req, res) =>
  res.json({
    success: true,
    data: {
      activity: await service.listProjectActivity(
        req.user!.id,
        getRouteParam(req.params.projectId, "projectId"),
        Number(req.query.limit ?? 50),
      ),
    },
  });

export const listProjectMembers: RequestHandler = async (req, res) =>
  res.json({
    success: true,
    data: {
      members: await service.listProjectMembers(
        req.user!.id,
        getRouteParam(req.params.projectId, "projectId"),
      ),
    },
  });

export const listProjectInvitations: RequestHandler = async (req, res) =>
  res.json({
    success: true,
    data: {
      invitations: await service.listProjectInvitations(
        req.user!.id,
        getRouteParam(req.params.projectId, "projectId"),
      ),
    },
  });

export const createProjectInvitation: RequestHandler = async (req, res) =>
  res.status(201).json({
    success: true,
    data: {
      invitation: await service.createProjectInvitation(
        req.user!.id,
        getRouteParam(req.params.projectId, "projectId"),
        req.body,
      ),
    },
  });

export const cancelProjectInvitation: RequestHandler = async (req, res) =>
  res.json({
    success: true,
    data: {
      invitation: await service.cancelProjectInvitation(
        req.user!.id,
        getRouteParam(req.params.invitationId, "invitationId"),
      ),
    },
  });

export const acceptProjectInvitation: RequestHandler = async (req, res) =>
  res.json({
    success: true,
    data: {
      member: await service.acceptProjectInvitation(req.user!.id, req.body),
    },
  });
