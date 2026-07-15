import type { IntegrationProvider, IntegrationStatus, Prisma } from "@prisma/client";
import { prisma } from "../../config/prisma.js";
import { ApiError } from "../../utils/api-error.js";
import { decryptSecretValue, encryptSecretValue } from "../../lib/encryption.js";
import { ADMIN_ROLES, assertRole, getProjectAccess } from "../projects/project.access.js";
import type { CreateProjectIntegrationInput, ExecuteProjectIntegrationInput, UpdateProjectIntegrationInput, UpsertProjectIntegrationSecretInput } from "./integration.schema.js";

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

const integrationSecretSelect = {
  id: true,
  integrationId: true,
  name: true,
  keyFingerprint: true,
  createdAt: true,
  updatedAt: true,
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

function parseGitHubRepository(value: string | null) {
  if (!value) throw new ApiError(400, "GitHub integration external reference must be owner/repo or a GitHub repository URL");

  const trimmed = value.trim();
  const directMatch = /^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)$/.exec(trimmed);
  if (directMatch?.[1] && directMatch[2]) return { owner: directMatch[1], repo: directMatch[2] };

  try {
    const url = new URL(trimmed);
    if (url.protocol !== "https:" || url.hostname.toLowerCase() !== "github.com") {
      throw new ApiError(400, "GitHub repository URL must use https://github.com");
    }
    const [owner, repo] = url.pathname.split("/").filter(Boolean);
    if (owner && repo) return { owner, repo: repo.replace(/\.git$/i, "") };
  } catch (error) {
    if (error instanceof ApiError) throw error;
  }

  throw new ApiError(400, "GitHub integration external reference must be owner/repo or a GitHub repository URL");
}

function createGitHubIssueBody(task: {
  description: string;
  type: string;
  priority: string;
  status: string;
  storyPoints: number | null;
  labels: string[];
  assignee: { name: string; email: string } | null;
  sprint: { name: string } | null;
}) {
  return [
    task.description,
    "",
    "### SpecForge metadata",
    `- Type: ${task.type}`,
    `- Priority: ${task.priority}`,
    `- Status: ${task.status}`,
    `- Story points: ${task.storyPoints ?? "Not estimated"}`,
    `- Sprint: ${task.sprint?.name ?? "Backlog"}`,
    `- Assignee: ${task.assignee ? `${task.assignee.name} <${task.assignee.email}>` : "Unassigned"}`,
    `- Labels: ${task.labels.length > 0 ? task.labels.join(", ") : "None"}`,
    "",
    "_Created by SpecForge AI._",
  ].join("\n");
}

function getRecordValue(value: unknown, key: string) {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>)[key] : undefined;
}

function parseLinearTeamId(externalRef: string | null, config: unknown) {
  const configuredTeamId = getRecordValue(config, "teamId");
  if (typeof configuredTeamId === "string" && configuredTeamId.trim()) return configuredTeamId.trim();

  if (externalRef?.trim()) return externalRef.trim();

  throw new ApiError(400, "Linear integration requires teamId in config or external reference");
}

function createLinearDescription(task: {
  description: string;
  type: string;
  priority: string;
  status: string;
  storyPoints: number | null;
  labels: string[];
  assignee: { name: string; email: string } | null;
  sprint: { name: string } | null;
}) {
  return [
    task.description,
    "",
    "## SpecForge metadata",
    `- Type: ${task.type}`,
    `- Priority: ${task.priority}`,
    `- Status: ${task.status}`,
    `- Story points: ${task.storyPoints ?? "Not estimated"}`,
    `- Sprint: ${task.sprint?.name ?? "Backlog"}`,
    `- Assignee: ${task.assignee ? `${task.assignee.name} <${task.assignee.email}>` : "Unassigned"}`,
    `- Labels: ${task.labels.length > 0 ? task.labels.join(", ") : "None"}`,
    "",
    "_Created by SpecForge AI._",
  ].join("\n");
}

function parseJiraConfig(externalRef: string | null, config: unknown) {
  const siteUrlValue = getRecordValue(config, "siteUrl");
  const siteUrlText = typeof siteUrlValue === "string" && siteUrlValue.trim() ? siteUrlValue.trim() : externalRef?.trim();
  if (!siteUrlText) throw new ApiError(400, "Jira integration requires siteUrl in config or external reference");

  let siteUrl: URL;
  try {
    siteUrl = new URL(siteUrlText);
  } catch {
    throw new ApiError(400, "Jira siteUrl must be a valid URL");
  }
  if (siteUrl.protocol !== "https:") throw new ApiError(400, "Jira siteUrl must use HTTPS");

  const projectKey = getRecordValue(config, "projectKey");
  if (typeof projectKey !== "string" || !projectKey.trim()) {
    throw new ApiError(400, "Jira integration requires projectKey in config");
  }

  const issueTypeValue = getRecordValue(config, "issueType");
  const issueType = typeof issueTypeValue === "string" && issueTypeValue.trim() ? issueTypeValue.trim() : "Task";
  const emailValue = getRecordValue(config, "email");
  const authSchemeValue = getRecordValue(config, "authScheme");

  return {
    siteUrl: siteUrl.origin,
    projectKey: projectKey.trim(),
    issueType,
    email: typeof emailValue === "string" && emailValue.trim() ? emailValue.trim() : null,
    authScheme: typeof authSchemeValue === "string" ? authSchemeValue.toLowerCase() : "bearer",
  };
}

function jiraDescriptionDocument(text: string) {
  return {
    type: "doc",
    version: 1,
    content: text.split("\n").map((line) => ({
      type: "paragraph",
      content: line ? [{ type: "text", text: line }] : [],
    })),
  };
}

function createJiraDescription(task: {
  description: string;
  type: string;
  priority: string;
  status: string;
  storyPoints: number | null;
  labels: string[];
  assignee: { name: string; email: string } | null;
  sprint: { name: string } | null;
}) {
  return [
    task.description,
    "",
    "SpecForge metadata",
    `Type: ${task.type}`,
    `Priority: ${task.priority}`,
    `Status: ${task.status}`,
    `Story points: ${task.storyPoints ?? "Not estimated"}`,
    `Sprint: ${task.sprint?.name ?? "Backlog"}`,
    `Assignee: ${task.assignee ? `${task.assignee.name} <${task.assignee.email}>` : "Unassigned"}`,
    `Labels: ${task.labels.length > 0 ? task.labels.join(", ") : "None"}`,
    "",
    "Created by SpecForge AI.",
  ].join("\n");
}

function createJiraAuthHeader(token: string, input: { authScheme: string; email: string | null }) {
  if (input.authScheme === "basic") {
    if (!input.email) throw new ApiError(400, "Jira Basic auth requires email in integration config");
    return `Basic ${Buffer.from(`${input.email}:${token}`).toString("base64")}`;
  }

  return `Bearer ${token}`;
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

async function assertIntegrationAdminAccess(userId: string, integrationId: string) {
  const integration = await prisma.projectIntegration.findUnique({
    where: { id: integrationId },
    select: { projectId: true },
  });
  if (!integration) throw new ApiError(404, "Integration was not found");

  const access = await getProjectAccess(userId, integration.projectId);
  assertRole(access.role, ADMIN_ROLES, "Only owners or admins can manage integration secrets");

  return integration;
}

export async function listProjectIntegrationSecrets(userId: string, integrationId: string) {
  await assertIntegrationAdminAccess(userId, integrationId);

  return prisma.projectIntegrationSecret.findMany({
    where: { integrationId },
    select: integrationSecretSelect,
    orderBy: { name: "asc" },
  });
}

export async function upsertProjectIntegrationSecret(userId: string, integrationId: string, input: UpsertProjectIntegrationSecretInput) {
  await assertIntegrationAdminAccess(userId, integrationId);
  const encrypted = encryptSecretValue(input.value);

  return prisma.projectIntegrationSecret.upsert({
    where: { integrationId_name: { integrationId, name: input.name } },
    update: encrypted,
    create: {
      integrationId,
      name: input.name,
      ...encrypted,
    },
    select: integrationSecretSelect,
  });
}

export async function deleteProjectIntegrationSecret(userId: string, integrationId: string, name: string) {
  await assertIntegrationAdminAccess(userId, integrationId);

  await prisma.projectIntegrationSecret.delete({
    where: { integrationId_name: { integrationId, name } },
  }).catch((error: unknown) => {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2025") {
      throw new ApiError(404, "Integration secret was not found");
    }
    throw error;
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

  if (integration.provider === "GITHUB") {
    const secret = await prisma.projectIntegrationSecret.findUnique({
      where: { integrationId_name: { integrationId, name: "accessToken" } },
      select: { encryptedValue: true, iv: true, authTag: true },
    });
    if (!secret) {
      const message = "GitHub execution needs an accessToken secret";
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

    const { owner, repo } = parseGitHubRepository(integration.externalRef);
    const issues = input.action === "SEND_TEST"
      ? [{
          title: `[SpecForge] Test issue for ${integration.project.name}`,
          body: "This test issue confirms SpecForge AI can create GitHub issues for this project.",
          labels: ["specforge"],
        }]
      : tasks.slice(0, 20).map((task) => ({
          title: task.title,
          body: createGitHubIssueBody(task),
          labels: [...new Set(["specforge", task.type.toLowerCase(), task.priority.toLowerCase(), ...task.labels])].slice(0, 10),
        }));

    if (issues.length === 0) throw new ApiError(400, "No tasks are available to export to GitHub");

    if (input.dryRun) {
      const run = await prisma.projectIntegrationRun.create({
        data: {
          integrationId,
          projectId: integration.projectId,
          actorId: userId,
          action: input.action,
          status: "CONNECTED",
          requestSummary: toJsonObject({ ...requestSummary, repository: `${owner}/${repo}`, issueCount: issues.length }),
          responseBody: "GitHub dry run completed without creating issues",
        },
        select: integrationRunSelect,
      });
      return { run, delivered: false };
    }

    const token = decryptSecretValue(secret);
    const createdIssues: Array<{ id: number; number: number; url: string }> = [];
    let lastResponseCode: number | null = null;
    let lastResponseBody = "";

    for (const issue of issues) {
      const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/issues`, {
        method: "POST",
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          "User-Agent": "SpecForge-AI/1.0",
          "X-GitHub-Api-Version": "2022-11-28",
        },
        body: JSON.stringify(issue),
        signal: AbortSignal.timeout(10_000),
      });
      lastResponseCode = response.status;
      lastResponseBody = truncateResponseBody(await response.text().catch(() => ""));

      if (!response.ok) break;

      const payload = JSON.parse(lastResponseBody) as { id?: number; number?: number; html_url?: string };
      createdIssues.push({
        id: payload.id ?? 0,
        number: payload.number ?? 0,
        url: payload.html_url ?? "",
      });
    }

    const delivered = createdIssues.length === issues.length;
    const responseBody = JSON.stringify({ repository: `${owner}/${repo}`, createdIssues, attempted: issues.length });
    const errorMessage = delivered ? null : `GitHub issue creation failed after ${createdIssues.length}/${issues.length} issue(s)`;
    const run = await prisma.projectIntegrationRun.create({
      data: {
        integrationId,
        projectId: integration.projectId,
        actorId: userId,
        action: input.action,
        status: delivered ? "CONNECTED" : "ERROR",
        requestSummary: toJsonObject({ ...requestSummary, repository: `${owner}/${repo}`, issueCount: issues.length }),
        responseCode: lastResponseCode,
        responseBody: truncateResponseBody(responseBody.length > 20 ? responseBody : lastResponseBody),
        errorMessage,
      },
      select: integrationRunSelect,
    });
    await prisma.projectIntegration.update({
      where: { id: integrationId },
      data: delivered
        ? { lastSyncedAt: new Date(), lastError: null, status: "CONNECTED" }
        : { lastError: errorMessage, status: "ERROR" },
    });
    return { run, delivered };
  }

  if (integration.provider === "LINEAR") {
    const secret = await prisma.projectIntegrationSecret.findUnique({
      where: { integrationId_name: { integrationId, name: "accessToken" } },
      select: { encryptedValue: true, iv: true, authTag: true },
    });
    if (!secret) {
      const message = "Linear execution needs an accessToken secret";
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

    const teamId = parseLinearTeamId(integration.externalRef, integration.config);
    const issues = input.action === "SEND_TEST"
      ? [{
          title: `[SpecForge] Test issue for ${integration.project.name}`,
          description: "This test issue confirms SpecForge AI can create Linear issues for this project.",
        }]
      : tasks.slice(0, 20).map((task) => ({
          title: task.title,
          description: createLinearDescription(task),
        }));

    if (issues.length === 0) throw new ApiError(400, "No tasks are available to export to Linear");

    if (input.dryRun) {
      const run = await prisma.projectIntegrationRun.create({
        data: {
          integrationId,
          projectId: integration.projectId,
          actorId: userId,
          action: input.action,
          status: "CONNECTED",
          requestSummary: toJsonObject({ ...requestSummary, teamId, issueCount: issues.length }),
          responseBody: "Linear dry run completed without creating issues",
        },
        select: integrationRunSelect,
      });
      return { run, delivered: false };
    }

    const token = decryptSecretValue(secret);
    const createdIssues: Array<{ id: string; identifier: string; url: string }> = [];
    let lastResponseCode: number | null = null;
    let lastResponseBody = "";

    const mutation = `
      mutation SpecForgeIssueCreate($input: IssueCreateInput!) {
        issueCreate(input: $input) {
          success
          issue {
            id
            identifier
            url
          }
        }
      }
    `;

    for (const issue of issues) {
      const response = await fetch("https://api.linear.app/graphql", {
        method: "POST",
        headers: {
          Authorization: token,
          "Content-Type": "application/json",
          "User-Agent": "SpecForge-AI/1.0",
        },
        body: JSON.stringify({
          query: mutation,
          variables: {
            input: {
              teamId,
              title: issue.title,
              description: issue.description,
            },
          },
        }),
        signal: AbortSignal.timeout(10_000),
      });
      lastResponseCode = response.status;
      lastResponseBody = truncateResponseBody(await response.text().catch(() => ""));

      if (!response.ok) break;

      const payload = JSON.parse(lastResponseBody) as {
        data?: { issueCreate?: { success?: boolean; issue?: { id?: string; identifier?: string; url?: string } } };
        errors?: unknown[];
      };
      const created = payload.data?.issueCreate;
      if (!created?.success || !created.issue) break;
      createdIssues.push({
        id: created.issue.id ?? "",
        identifier: created.issue.identifier ?? "",
        url: created.issue.url ?? "",
      });
    }

    const delivered = createdIssues.length === issues.length;
    const responseBody = JSON.stringify({ teamId, createdIssues, attempted: issues.length });
    const errorMessage = delivered ? null : `Linear issue creation failed after ${createdIssues.length}/${issues.length} issue(s)`;
    const run = await prisma.projectIntegrationRun.create({
      data: {
        integrationId,
        projectId: integration.projectId,
        actorId: userId,
        action: input.action,
        status: delivered ? "CONNECTED" : "ERROR",
        requestSummary: toJsonObject({ ...requestSummary, teamId, issueCount: issues.length }),
        responseCode: lastResponseCode,
        responseBody: truncateResponseBody(responseBody.length > 20 ? responseBody : lastResponseBody),
        errorMessage,
      },
      select: integrationRunSelect,
    });
    await prisma.projectIntegration.update({
      where: { id: integrationId },
      data: delivered
        ? { lastSyncedAt: new Date(), lastError: null, status: "CONNECTED" }
        : { lastError: errorMessage, status: "ERROR" },
    });
    return { run, delivered };
  }

  if (integration.provider === "JIRA") {
    const secret = await prisma.projectIntegrationSecret.findUnique({
      where: { integrationId_name: { integrationId, name: "accessToken" } },
      select: { encryptedValue: true, iv: true, authTag: true },
    });
    if (!secret) {
      const message = "Jira execution needs an accessToken secret";
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

    const jira = parseJiraConfig(integration.externalRef, integration.config);
    const issues = input.action === "SEND_TEST"
      ? [{
          summary: `[SpecForge] Test issue for ${integration.project.name}`,
          description: "This test issue confirms SpecForge AI can create Jira issues for this project.",
          labels: ["specforge"],
        }]
      : tasks.slice(0, 20).map((task) => ({
          summary: task.title,
          description: createJiraDescription(task),
          labels: [...new Set(["specforge", task.type, task.priority, ...task.labels])]
            .map((label) => label.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-|-$/g, ""))
            .filter(Boolean)
            .slice(0, 10),
        }));

    if (issues.length === 0) throw new ApiError(400, "No tasks are available to export to Jira");

    if (input.dryRun) {
      const run = await prisma.projectIntegrationRun.create({
        data: {
          integrationId,
          projectId: integration.projectId,
          actorId: userId,
          action: input.action,
          status: "CONNECTED",
          requestSummary: toJsonObject({ ...requestSummary, siteUrl: jira.siteUrl, projectKey: jira.projectKey, issueCount: issues.length }),
          responseBody: "Jira dry run completed without creating issues",
        },
        select: integrationRunSelect,
      });
      return { run, delivered: false };
    }

    const token = decryptSecretValue(secret);
    const createdIssues: Array<{ id: string; key: string; url: string }> = [];
    let lastResponseCode: number | null = null;
    let lastResponseBody = "";

    for (const issue of issues) {
      const response = await fetch(`${jira.siteUrl}/rest/api/3/issue`, {
        method: "POST",
        headers: {
          Accept: "application/json",
          Authorization: createJiraAuthHeader(token, jira),
          "Content-Type": "application/json",
          "User-Agent": "SpecForge-AI/1.0",
        },
        body: JSON.stringify({
          fields: {
            project: { key: jira.projectKey },
            issuetype: { name: jira.issueType },
            summary: issue.summary,
            description: jiraDescriptionDocument(issue.description),
            labels: issue.labels,
          },
        }),
        signal: AbortSignal.timeout(10_000),
      });
      lastResponseCode = response.status;
      lastResponseBody = truncateResponseBody(await response.text().catch(() => ""));

      if (!response.ok) break;

      const payload = JSON.parse(lastResponseBody) as { id?: string; key?: string; self?: string };
      createdIssues.push({
        id: payload.id ?? "",
        key: payload.key ?? "",
        url: payload.key ? `${jira.siteUrl}/browse/${payload.key}` : (payload.self ?? ""),
      });
    }

    const delivered = createdIssues.length === issues.length;
    const responseBody = JSON.stringify({ siteUrl: jira.siteUrl, projectKey: jira.projectKey, createdIssues, attempted: issues.length });
    const errorMessage = delivered ? null : `Jira issue creation failed after ${createdIssues.length}/${issues.length} issue(s)`;
    const run = await prisma.projectIntegrationRun.create({
      data: {
        integrationId,
        projectId: integration.projectId,
        actorId: userId,
        action: input.action,
        status: delivered ? "CONNECTED" : "ERROR",
        requestSummary: toJsonObject({ ...requestSummary, siteUrl: jira.siteUrl, projectKey: jira.projectKey, issueCount: issues.length }),
        responseCode: lastResponseCode,
        responseBody: truncateResponseBody(responseBody.length > 20 ? responseBody : lastResponseBody),
        errorMessage,
      },
      select: integrationRunSelect,
    });
    await prisma.projectIntegration.update({
      where: { id: integrationId },
      data: delivered
        ? { lastSyncedAt: new Date(), lastError: null, status: "CONNECTED" }
        : { lastError: errorMessage, status: "ERROR" },
    });
    return { run, delivered };
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
