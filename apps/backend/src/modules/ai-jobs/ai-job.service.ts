import { AIJobStatus, type AIErrorCategory, type AIJobType } from "@prisma/client";
import { prisma } from "../../config/prisma.js";
import { ApiError } from "../../utils/api-error.js";
import { getProjectAccess } from "../projects/project.access.js";

interface CreateAIJobInput {
  type: AIJobType;
  userId: string;
  projectId: string;
  requirementId?: string;
  analysisId?: string;
  idempotencyKey: string;
  provider?: string;
  model?: string;
  promptSchemaVersion?: string;
}

interface EnqueueAIJobInput extends CreateAIJobInput {
  maxAttempts?: number;
}

interface CompleteAIJobInput {
  attempts: number;
  durationMs: number;
  promptTokens?: number | null;
  completionTokens?: number | null;
  totalTokens?: number | null;
  outputRef?: string;
}

interface FailAIJobInput {
  attempts: number;
  durationMs?: number | null;
  errorCategory: AIErrorCategory;
  errorMessage: string;
}

interface ListAIJobsFilters {
  status?: AIJobStatus;
  type?: AIJobType;
  limit?: number;
}

const select = {
  id: true,
  type: true,
  status: true,
  userId: true,
  projectId: true,
  requirementId: true,
  analysisId: true,
  provider: true,
  model: true,
  promptSchemaVersion: true,
  attempts: true,
  maxAttempts: true,
  durationMs: true,
  promptTokens: true,
  completionTokens: true,
  totalTokens: true,
  errorCategory: true,
  errorMessage: true,
  outputRef: true,
  startedAt: true,
  completedAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

export async function getAIJob(userId: string, jobId: string) {
  const job = await prisma.aIJob.findFirst({
    where: {
      id: jobId,
      project: {
        workspace: {
          memberships: { some: { userId } },
        },
      },
    },
    select,
  });

  if (!job) throw new ApiError(404, "AI job was not found");
  return job;
}

export async function listProjectAIJobs(userId: string, projectId: string, filters: ListAIJobsFilters) {
  await getProjectAccess(userId, projectId);

  return prisma.aIJob.findMany({
    where: {
      projectId,
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.type ? { type: filters.type } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: filters.limit ?? 25,
    select,
  });
}

export async function enqueueAIJob(input: EnqueueAIJobInput) {
  return prisma.aIJob.upsert({
    where: {
      type_idempotencyKey: {
        type: input.type,
        idempotencyKey: input.idempotencyKey,
      },
    },
    create: {
      type: input.type,
      userId: input.userId,
      projectId: input.projectId,
      requirementId: input.requirementId ?? null,
      analysisId: input.analysisId ?? null,
      idempotencyKey: input.idempotencyKey,
      provider: input.provider ?? null,
      model: input.model ?? null,
      promptSchemaVersion: input.promptSchemaVersion ?? null,
      maxAttempts: input.maxAttempts ?? 3,
      status: AIJobStatus.QUEUED,
    },
    update: {},
    select,
  });
}

export async function markAIJobRunning(jobId: string) {
  return prisma.aIJob.update({
    where: { id: jobId },
    data: {
      status: AIJobStatus.RUNNING,
      startedAt: new Date(),
      completedAt: null,
      errorCategory: null,
      errorMessage: null,
    },
    select,
  });
}

export async function createAIJob(input: CreateAIJobInput) {
  const job = await enqueueAIJob(input);
  return markAIJobRunning(job.id);
}

export async function completeAIJob(jobId: string, input: CompleteAIJobInput) {
  return prisma.aIJob.update({
    where: { id: jobId },
    data: {
      status: AIJobStatus.COMPLETED,
      attempts: input.attempts,
      durationMs: input.durationMs,
      promptTokens: input.promptTokens ?? null,
      completionTokens: input.completionTokens ?? null,
      totalTokens: input.totalTokens ?? null,
      outputRef: input.outputRef ?? null,
      completedAt: new Date(),
      errorCategory: null,
      errorMessage: null,
    },
    select,
  });
}

export async function failAIJob(jobId: string, input: FailAIJobInput) {
  return prisma.aIJob.update({
    where: { id: jobId },
    data: {
      status: AIJobStatus.FAILED,
      attempts: input.attempts,
      durationMs: input.durationMs ?? null,
      errorCategory: input.errorCategory,
      errorMessage: input.errorMessage,
      completedAt: new Date(),
    },
    select,
  });
}
