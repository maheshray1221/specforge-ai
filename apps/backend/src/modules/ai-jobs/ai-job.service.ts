import { AIJobStatus, type AIErrorCategory, type AIJobType } from "@prisma/client";
import { prisma } from "../../config/prisma.js";

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

const select = {
  id: true,
  type: true,
  status: true,
  projectId: true,
  requirementId: true,
  analysisId: true,
  attempts: true,
  durationMs: true,
  promptTokens: true,
  completionTokens: true,
  totalTokens: true,
  errorCategory: true,
  errorMessage: true,
  outputRef: true,
  createdAt: true,
  updatedAt: true,
} as const;

export async function createAIJob(input: CreateAIJobInput) {
  const job = await prisma.aIJob.upsert({
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
      status: AIJobStatus.QUEUED,
    },
    update: {},
    select,
  });

  return prisma.aIJob.update({
    where: { id: job.id },
    data: {
      status: AIJobStatus.RUNNING,
      startedAt: new Date(),
      errorCategory: null,
      errorMessage: null,
    },
    select,
  });
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
