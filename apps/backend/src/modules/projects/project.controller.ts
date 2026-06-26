import type { RequestHandler } from "express";
import * as service from "./project.service.js";

export const create: RequestHandler = async (req, res) => res.status(201).json({ success: true, data: { project: await service.createProject(req.user!.id, req.body) } });
export const list: RequestHandler = async (req, res) => res.json({ success: true, data: { projects: await service.listProjects(req.user!.id, req.query as never) } });
export const getOne: RequestHandler = async (req, res) => res.json({ success: true, data: { project: await service.getProject(req.user!.id, req.params.projectId!) } });
export const update: RequestHandler = async (req, res) => res.json({ success: true, data: { project: await service.updateProject(req.user!.id, req.params.projectId!, req.body) } });
export const archive: RequestHandler = async (req, res) => res.json({ success: true, data: { project: await service.archiveProject(req.user!.id, req.params.projectId!) } });
