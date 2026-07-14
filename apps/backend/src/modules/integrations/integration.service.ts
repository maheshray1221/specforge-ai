import type { IntegrationProvider, IntegrationStatus, Prisma } from "@prisma/client";
import { prisma } from "../../config/prisma.js";
import { ApiError } from "../../utils/api-error.js";
import { ADMIN_ROLES, assertRole, getProjectAccess } from "../projects/project.access.js";
import type { CreateProjectIntegrationInput, UpdateProjectIntegrationInput } from "./integration.schema.js";

const integrationSelect = {
  id: true,
  projectId: true,
  provider: true,
  status: true,
  displayName: true,
  externalRef: true,
  config: true,
  lastSyncedAt: true,
  lastError: true,
  createdAt: true,
  updatedAt: true,
} as const;

export async function listProjectIntegrations(
  userId: string,
  projectId: string,
  filters: { provider?: IntegrationProvider; status?: IntegrationStatus },
) {
  await getProjectAccess(userId, projectId);

  return prisma.projectIntegration.findMany({
    where: {
      projectId,
      ...(filters.provider ? { provider: filters.provider } : {}),
      ...(filters.status ? { status: filters.status } : {}),
    },
    select: integrationSelect,
    orderBy: [{ provider: "asc" }, { displayName: "asc" }],
  });
}

export async function createProjectIntegration(userId: string, projectId: string, input: CreateProjectIntegrationInput) {
  const access = await getProjectAccess(userId, projectId);
  assertRole(access.role, ADMIN_ROLES, "Only owners or admins can manage integrations");

  return prisma.projectIntegration.create({
    data: {
      projectId,
      provider: input.provider,
      displayName: input.displayName,
      externalRef: input.externalRef ?? null,
      config: input.config as Prisma.InputJsonObject,
    },
    select: integrationSelect,
  });
}

export async function updateProjectIntegration(userId: string, integrationId: string, input: UpdateProjectIntegrationInput) {
  const integration = await prisma.projectIntegration.findUnique({
    where: { id: integrationId },
    select: { projectId: true },
  });
  if (!integration) throw new ApiError(404, "Integration was not found");

  const access = await getProjectAccess(userId, integration.projectId);
  assertRole(access.role, ADMIN_ROLES, "Only owners or admins can manage integrations");

  return prisma.projectIntegration.update({
    where: { id: integrationId },
    data: {
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.displayName !== undefined ? { displayName: input.displayName } : {}),
      ...(input.externalRef !== undefined ? { externalRef: input.externalRef } : {}),
      ...(input.config !== undefined ? { config: input.config as Prisma.InputJsonObject } : {}),
      ...(input.lastError !== undefined ? { lastError: input.lastError } : {}),
    },
    select: integrationSelect,
  });
}

export async function deleteProjectIntegration(userId: string, integrationId: string) {
  const integration = await prisma.projectIntegration.findUnique({
    where: { id: integrationId },
    select: { projectId: true },
  });
  if (!integration) throw new ApiError(404, "Integration was not found");

  const access = await getProjectAccess(userId, integration.projectId);
  assertRole(access.role, ADMIN_ROLES, "Only owners or admins can manage integrations");

  await prisma.projectIntegration.delete({ where: { id: integrationId } });
}
