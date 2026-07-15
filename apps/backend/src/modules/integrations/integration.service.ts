import type { IntegrationProvider, IntegrationStatus, Prisma } from "@prisma/client";
import { prisma } from "../../config/prisma.js";
import { ApiError } from "../../utils/api-error.js";
import { ADMIN_ROLES, assertRole, getProjectAccess } from "../projects/project.access.js";
import type { CreateProjectIntegrationInput, ExecuteProjectIntegrationInput, UpdateProjectIntegrationInput } from "./integration.schema.js";

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

const integrationRunSelect = {
  id: true,
  integrationId: true,
  projectId: true,
  actorId: true,
  action: true,
  status: true,
  requestSummary: true,
  responseCode: true,
  responseBody: true,
  errorMessage: true,
  createdAt: true,
} as const;

function assertPublicHttpsUrl(value: string | null) {
  if (!value) throw new ApiError(400, "Integration external reference must be an HTTPS URL");

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new ApiError(400, "Integration external reference must be a valid HTTPS URL");
  }

  if (url.protocol !== "https:") throw new ApiError(400, "Integration execution requires an HTTPS URL");

  const hostname = url.hostname.toLowerCase();
  const privatePatterns = [
    "localhost",
    "127.",
    "10.",
    "192.168.",
    "169.254.",
    "::1",
  ];
  const isPrivate172 = /^172\.(1[6-9]|2\d|3[01])\./.test(hostname);
  if (privatePatterns.some((pattern) => hostname === pattern || hostname.startsWith(pattern)) || isPrivate172) {
    throw new ApiError(400, "Private or local integration URLs are not allowed");
  }

  return url;
}

function truncateResponseBody(value: string) {
  return value.length > 1000 ? `${value.slice(0, 1000)}...` : value;
}

function toJsonObject(value: Record<string, unknown>): Prisma.InputJsonObject {
  return value as Prisma.InputJsonObject;
}

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

export async function listProjectIntegrationRuns(userId: string, integrationId: string) {
  const integration = await prisma.projectIntegration.findUnique({
    where: { id: integrationId },
    select: { projectId: true },
  });
  if (!integration) throw new ApiError(404, "Integration was not found");

  await getProjectAccess(userId, integration.projectId);

  return prisma.projectIntegrationRun.findMany({
    where: { integrationId },
    select: integrationRunSelect,
    orderBy: { createdAt: "desc" },
    take: 25,
  });
}

export async function executeProjectIntegration(userId: string, integrationId: string, input: ExecuteProjectIntegrationInput) {
  const integration = await prisma.projectIntegration.findUnique({
    where: { id: integrationId },
    select: {
      ...integrationSelect,
      project: { select: { id: true, key: true, name: true } },
    },
  });
  if (!integration) throw new ApiError(404, "Integration was not found");

  const access = await getProjectAccess(userId, integration.projectId);
  assertRole(access.role, ADMIN_ROLES, "Only owners or admins can execute integrations");
  if (integration.status === "PAUSED") throw new ApiError(409, "Paused integrations cannot be executed");

  const tasks = input.action === "EXPORT_TASKS"
    ? await prisma.task.findMany({
        where: {
          projectId: integration.projectId,
          ...(input.taskIds.length > 0 ? { id: { in: input.taskIds } } : {}),
        },
        select: {
          id: true,
          title: true,
          description: true,
          type: true,
          priority: true,
          status: true,
          storyPoints: true,
          labels: true,
          assignee: { select: { name: true, email: true } },
          sprint: { select: { name: true } },
        },
        orderBy: [{ status: "asc" }, { position: "asc" }, { createdAt: "asc" }],
        take: 100,
      })
    : [];

  const requestSummary = {
    provider: integration.provider,
    action: input.action,
    dryRun: input.dryRun,
    project: integration.project,
    taskCount: tasks.length,
  };

  if (["GITHUB", "JIRA", "LINEAR"].includes(integration.provider)) {
    const message = "GitHub/Jira/Linear execution needs a secure secret-token store before real issue creation can be enabled";
    const run = await prisma.projectIntegrationRun.create({
      data: {
        integrationId,
        projectId: integration.projectId,
        actorId: userId,
        action: input.action,
        status: "ERROR",
        requestSummary: toJsonObject(requestSummary),
        errorMessage: message,
      },
      select: integrationRunSelect,
    });
    await prisma.projectIntegration.update({
      where: { id: integrationId },
      data: { lastError: message, status: "ERROR" },
    });
    return { run, delivered: false };
  }

  const targetUrl = assertPublicHttpsUrl(integration.externalRef);
  const payload = integration.provider === "SLACK"
    ? {
        text: input.action === "SEND_TEST"
          ? `SpecForge AI test message for ${integration.project.name}`
          : `SpecForge AI exported ${tasks.length} task(s) from ${integration.project.name}`,
        project: integration.project,
        tasks,
      }
    : {
        event: input.action,
        source: "specforge-ai",
        project: integration.project,
        integration: { id: integration.id, provider: integration.provider, displayName: integration.displayName },
        tasks,
      };

  if (input.dryRun) {
    const run = await prisma.projectIntegrationRun.create({
      data: {
        integrationId,
        projectId: integration.projectId,
        actorId: userId,
        action: input.action,
        status: "CONNECTED",
        requestSummary: toJsonObject({ ...requestSummary, targetHost: targetUrl.hostname }),
        responseBody: "Dry run completed without sending an external request",
      },
      select: integrationRunSelect,
    });
    return { run, delivered: false };
  }

  try {
    const response = await fetch(targetUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", "User-Agent": "SpecForge-AI/1.0" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10_000),
    });
    const responseBody = truncateResponseBody(await response.text().catch(() => ""));
    const ok = response.ok;
    const run = await prisma.projectIntegrationRun.create({
      data: {
        integrationId,
        projectId: integration.projectId,
        actorId: userId,
        action: input.action,
        status: ok ? "CONNECTED" : "ERROR",
        requestSummary: toJsonObject({ ...requestSummary, targetHost: targetUrl.hostname }),
        responseCode: response.status,
        responseBody,
        errorMessage: ok ? null : `Integration endpoint returned HTTP ${response.status}`,
      },
      select: integrationRunSelect,
    });
    await prisma.projectIntegration.update({
      where: { id: integrationId },
      data: ok
        ? { lastSyncedAt: new Date(), lastError: null, status: "CONNECTED" }
        : { lastError: `HTTP ${response.status}`, status: "ERROR" },
    });
    return { run, delivered: ok };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Integration execution failed";
    const run = await prisma.projectIntegrationRun.create({
      data: {
        integrationId,
        projectId: integration.projectId,
        actorId: userId,
        action: input.action,
        status: "ERROR",
        requestSummary: toJsonObject({ ...requestSummary, targetHost: targetUrl.hostname }),
        errorMessage: message,
      },
      select: integrationRunSelect,
    });
    await prisma.projectIntegration.update({
      where: { id: integrationId },
      data: { lastError: message, status: "ERROR" },
    });
    return { run, delivered: false };
  }
}
