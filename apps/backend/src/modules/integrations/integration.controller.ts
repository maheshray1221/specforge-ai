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

export const listRuns: RequestHandler = async (req, res) =>
  res.json({
    success: true,
    data: {
      runs: await service.listProjectIntegrationRuns(
        req.user!.id,
        getRouteParam(req.params.integrationId, "integrationId"),
      ),
    },
  });

export const execute: RequestHandler = async (req, res) =>
  res.json({
    success: true,
    data: await service.executeProjectIntegration(
      req.user!.id,
      getRouteParam(req.params.integrationId, "integrationId"),
      req.body,
    ),
  });

export const listSecrets: RequestHandler = async (req, res) =>
  res.json({
    success: true,
    data: {
      secrets: await service.listProjectIntegrationSecrets(
        req.user!.id,
        getRouteParam(req.params.integrationId, "integrationId"),
      ),
    },
  });

export const upsertSecret: RequestHandler = async (req, res) =>
  res.json({
    success: true,
    data: {
      secret: await service.upsertProjectIntegrationSecret(
        req.user!.id,
        getRouteParam(req.params.integrationId, "integrationId"),
        req.body,
      ),
    },
  });

export const deleteSecret: RequestHandler = async (req, res) => {
  await service.deleteProjectIntegrationSecret(
    req.user!.id,
    getRouteParam(req.params.integrationId, "integrationId"),
    getRouteParam(req.params.name, "name"),
  );

  res.status(204).send();
};
