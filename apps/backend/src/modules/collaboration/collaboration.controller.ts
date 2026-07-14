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
