import type { RequestHandler } from "express";
import * as service from "./requirement.service.js";
import { getRouteParam } from "../../utils/route.param.js";

export const create: RequestHandler = async (req, res) =>
  res.status(201).json({
    success: true,
    data: {
      requirement: await service.createRequirement(
        req.user!.id,
        getRouteParam(req.params, "requirementId"),
        req.body,
      ),
    },
  });
export const list: RequestHandler = async (req, res) =>
  res.json({
    success: true,
    data: {
      requirements: await service.listRequirements(
        req.user!.id,
        getRouteParam(req.params, "requirementId"),
        req.query.status as string | undefined,
      ),
    },
  });
export const getOne: RequestHandler = async (req, res) =>
  res.json({
    success: true,
    data: {
      requirement: await service.getRequirement(
        req.user!.id,
        getRouteParam(req.params, "requirementId"),
      ),
    },
  });
export const update: RequestHandler = async (req, res) =>
  res.json({
    success: true,
    data: {
      requirement: await service.updateRequirement(
        req.user!.id,
        getRouteParam(req.params, "requirementId"),
        req.body,
      ),
    },
  });
export const remove: RequestHandler = async (req, res) => {
  await service.deleteRequirement(
    req.user!.id,
    getRouteParam(req.params, "requirementId"),
  );
  res.status(204).send();
};
