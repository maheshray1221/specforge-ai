import { AIJobStatus } from "@prisma/client";
import { env } from "../../config/env.js";
import { prisma } from "../../config/prisma.js";
import { ApiError } from "../../utils/api-error.js";
import { getProjectAccess } from "../projects/project.access.js";

function getCurrentMonthWindow(now = new Date()) {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));

  return { start, end };
}

export async function getProjectUsage(userId: string, projectId: string) {
  await getProjectAccess(userId, projectId);

  const { start, end } = getCurrentMonthWindow();
  const [jobCount, tokenAggregate, ...statusCounts] = await prisma.$transaction([
    prisma.aIJob.count({
      where: {
        projectId,
        createdAt: { gte: start, lt: end },
      },
    }),
    prisma.aIJob.aggregate({
      where: {
        projectId,
        createdAt: { gte: start, lt: end },
      },
      _sum: {
        totalTokens: true,
        promptTokens: true,
        completionTokens: true,
      },
    }),
    ...Object.values(AIJobStatus).map((status) =>
      prisma.aIJob.count({
        where: {
          projectId,
          status,
          createdAt: { gte: start, lt: end },
        },
      }),
    ),
  ]);
  const aiJobsByStatus = Object.fromEntries(
    Object.values(AIJobStatus).map((status, index) => [
      status,
      statusCounts[index] ?? 0,
    ]),
  );

  const totalTokens = tokenAggregate._sum.totalTokens ?? 0;

  return {
    period: {
      start: start.toISOString(),
      end: end.toISOString(),
    },
    usage: {
      aiJobs: jobCount,
      promptTokens: tokenAggregate._sum.promptTokens ?? 0,
      completionTokens: tokenAggregate._sum.completionTokens ?? 0,
      totalTokens,
      aiJobsByStatus,
    },
    quotas: {
      aiJobs: env.AI_MONTHLY_JOB_QUOTA,
      totalTokens: env.AI_MONTHLY_TOKEN_QUOTA,
    },
    remaining: {
      aiJobs: Math.max(0, env.AI_MONTHLY_JOB_QUOTA - jobCount),
      totalTokens: Math.max(0, env.AI_MONTHLY_TOKEN_QUOTA - totalTokens),
    },
  };
}

export async function assertProjectAIQuota(userId: string, projectId: string) {
  const usage = await getProjectUsage(userId, projectId);

  if (usage.remaining.aiJobs <= 0) {
    throw new ApiError(429, "Monthly AI job quota has been reached", {
      quota: usage.quotas.aiJobs,
      used: usage.usage.aiJobs,
      period: usage.period,
    });
  }

  if (usage.remaining.totalTokens <= 0) {
    throw new ApiError(429, "Monthly AI token quota has been reached", {
      quota: usage.quotas.totalTokens,
      used: usage.usage.totalTokens,
      period: usage.period,
    });
  }

  return usage;
}
