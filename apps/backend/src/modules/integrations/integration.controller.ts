import type { RequestHandler } from "express";
import { getRouteParam } from "../../utils/route.param.js";
import * as service from "./integration.service.js";

export const listForProject: RequestHandler = async (req, res) =>
  res.json({
    success: true,
    data: {
      integrations: await service.listProjectIntegrations(
        req.user!.id,
        getRouteParam(req.params.projectId, "projectId"),
        req.query as never,
      ),
    },
  });

export const createForProject: RequestHandler = async (req, res) =>
  res.status(201).json({
    success: true,
    data: {
      integration: await service.createProjectIntegration(
        req.user!.id,
        getRouteParam(req.params.projectId, "projectId"),
        req.body,
      ),
    },
  });

export const update: RequestHandler = async (req, res) =>
  res.json({
    success: true,
    data: {
      integration: await service.updateProjectIntegration(
        req.user!.id,
        getRouteParam(req.params.integrationId, "integrationId"),
        req.body,
      ),
    },
  });

export const remove: RequestHandler = async (req, res) => {
  await service.deleteProjectIntegration(
    req.user!.id,
    getRouteParam(req.params.integrationId, "integrationId"),
  );

  res.status(204).send();
};
