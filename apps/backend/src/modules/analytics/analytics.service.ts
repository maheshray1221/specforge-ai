import { AnalyticsEventType } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import { prisma } from "../../config/prisma.js";
import { ApiError } from "../../utils/api-error.js";
import { getProjectAccess } from "../projects/project.access.js";
import type { AnalysisFeedbackInput, TrackAnalyticsEventInput } from "./analytics.schema.js";

const eventSelect = {
  id: true,
  type: true,
  userId: true,
  projectId: true,
  entityType: true,
  entityId: true,
  metadata: true,
  createdAt: true,
} as const;

export async function trackAnalyticsEvent(userId: string, input: TrackAnalyticsEventInput) {
  if (input.projectId) await getProjectAccess(userId, input.projectId);

  return prisma.analyticsEvent.create({
    data: {
      type: input.type,
      userId,
      projectId: input.projectId ?? null,
      entityType: input.entityType ?? null,
      entityId: input.entityId ?? null,
      metadata: input.metadata as Prisma.InputJsonObject,
    },
    select: eventSelect,
  });
}

export async function getProjectAnalyticsSummary(userId: string, projectId: string, days: number) {
  await getProjectAccess(userId, projectId);
  const since = new Date(Date.now() - days * 86_400_000);
  const types = Object.values(AnalyticsEventType);
  const counts = await prisma.$transaction(
    types.map((type) =>
      prisma.analyticsEvent.count({
        where: {
          projectId,
          type,
          createdAt: { gte: since },
        },
      }),
    ),
  );

  const eventsByType = Object.fromEntries(types.map((type, index) => [type, counts[index] ?? 0]));

  return {
    period: {
      since: since.toISOString(),
      until: new Date().toISOString(),
      days,
    },
    eventsByType,
    activationFunnel: {
      projectCreated: eventsByType.PROJECT_CREATED ?? 0,
      requirementCreated: eventsByType.REQUIREMENT_CREATED ?? 0,
      requirementAnalyzed: eventsByType.REQUIREMENT_ANALYZED ?? 0,
      requirementApproved: eventsByType.REQUIREMENT_APPROVED ?? 0,
      tasksGenerated: eventsByType.TASKS_GENERATED ?? 0,
      sprintCreated: eventsByType.SPRINT_CREATED ?? 0,
    },
    aiFeedback: {
      submitted: eventsByType.ANALYSIS_FEEDBACK_SUBMITTED ?? 0,
    },
  };
}

export async function submitAnalysisFeedback(userId: string, analysisId: string, input: AnalysisFeedbackInput) {
  const analysis = await prisma.aIAnalysis.findFirst({
    where: { id: analysisId, requirement: { project: { workspace: { memberships: { some: { userId } } } } } },
    select: {
      id: true,
      provider: true,
      model: true,
      promptSchemaVersion: true,
      requirement: { select: { projectId: true } },
    },
  });
  if (!analysis) throw new ApiError(404, "Analysis was not found");

  return prisma.analyticsEvent.create({
    data: {
      type: AnalyticsEventType.ANALYSIS_FEEDBACK_SUBMITTED,
      userId,
      projectId: analysis.requirement.projectId,
      entityType: "AIAnalysis",
      entityId: analysisId,
      metadata: {
        useful: input.useful,
        reason: input.reason ?? null,
        provider: analysis.provider,
        model: analysis.model,
        promptSchemaVersion: analysis.promptSchemaVersion,
      },
    },
    select: eventSelect,
  });
}
