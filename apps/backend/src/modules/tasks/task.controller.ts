import type { RequestHandler } from "express";
import * as service from "./task.service.js";

export const generate: RequestHandler = async (req, res) => res.status(201).json({ success: true, data: await service.generateTasks(req.user!.id, req.params.analysisId!, req.body.regenerate) });
export const list: RequestHandler = async (req, res) => res.json({ success: true, data: { tasks: await service.listProjectTasks(req.user!.id, req.params.projectId!, req.query as never) } });
export const update: RequestHandler = async (req, res) => res.json({ success: true, data: { task: await service.updateTask(req.user!.id, req.params.taskId!, req.body) } });
