import type { RequestHandler } from "express";
import * as service from "./sprint.service.js";

export const create: RequestHandler = async (req, res) => res.status(201).json({ success: true, data: { sprint: await service.createSprint(req.user!.id, req.params.projectId!, req.body) } });
export const list: RequestHandler = async (req, res) => res.json({ success: true, data: { sprints: await service.listSprints(req.user!.id, req.params.projectId!) } });
export const update: RequestHandler = async (req, res) => res.json({ success: true, data: { sprint: await service.updateSprint(req.user!.id, req.params.sprintId!, req.body) } });
export const addTask: RequestHandler = async (req, res) => res.json({ success: true, data: { sprint: await service.addTask(req.user!.id, req.params.sprintId!, req.params.taskId!) } });
export const removeTask: RequestHandler = async (req, res) => res.json({ success: true, data: { sprint: await service.removeTask(req.user!.id, req.params.sprintId!, req.params.taskId!) } });
