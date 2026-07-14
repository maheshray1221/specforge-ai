import { AIJobType, AnalysisStatus, RequirementStatus } from "@prisma/client";
import { env } from "../../config/env.js";
import { prisma } from "../../config/prisma.js";
import { generateStructuredOutput } from "../../lib/ai/groq.client.js";
import { extractAIErrorTelemetry } from "../../lib/ai/telemetry.js";
import { ApiError } from "../../utils/api-error.js";
import { completeAIJob, createAIJob, failAIJob } from "../ai-jobs/ai-job.service.js";
import { WRITE_ROLES, assertRole, getProjectAccess } from "../projects/project.access.js";
import { aiAnalysisJsonSchema, aiAnalysisOutputSchema } from "./ai-analysis.output.js";
import { ANALYSIS_SYSTEM_PROMPT, buildAnalysisPrompt } from "./ai-analysis.prompt.js";

const analysisSelect = {
  id: true,
  requirementId: true,
  requirementVersionId: true,
  provider: true,
  model: true,
  status: true,
  clarificationQuestions: true,
  functionalRequirements: true,
  nonFunctionalRequirements: true,
  userStories: true,
  technicalPlan: true,
  risks: true,
  errorMessage: true,
  errorCategory: true,
  promptSchemaVersion: true,
  attempts: true,
  durationMs: true,
  promptTokens: true,
  completionTokens: true,
  totalTokens: true,
  taskGenerationAttempts: true,
  taskGenerationDurationMs: true,
  taskGenerationPromptTokens: true,
  taskGenerationCompletionTokens: true,
  taskGenerationTotalTokens: true,
  taskGenerationErrorCategory: true,
  taskGenerationErrorMessage: true,
  createdAt: true,
  updatedAt: true,
} as const;

const ANALYSIS_PROMPT_SCHEMA_VERSION = "requirement-analysis:v1";

export async function analyzeRequirement(userId: string, requirementId: string, force: boolean) {
  const requirement = await prisma.requirement.findFirst({
    where: { id: requirementId, project: { workspace: { memberships: { some: { userId } } } } },
    select: {
      id: true,
      title: true,
      currentContent: true,
      status: true,
      project: { select: { id: true, name: true } },
      versions: { orderBy: { versionNumber: "desc" }, take: 1, select: { id: true, content: true } },
      analyses: { orderBy: { createdAt: "desc" }, take: 1, select: analysisSelect },
    },
  });
  if (!requirement) throw new ApiError(404, "Requirement was not found");
  const access = await getProjectAccess(userId, requirement.project.id);
  assertRole(access.role, WRITE_ROLES, "Viewer members cannot run AI analysis");
  const version = requirement.versions[0];
  if (!version) throw new ApiError(409, "Requirement has no version to analyze");

  const existing = requirement.analyses[0];
  if (!force && existing?.status === AnalysisStatus.COMPLETED && existing.requirementVersionId === version.id) {
    return { analysis: existing, reused: true };
  }

  const record = await prisma.aIAnalysis.create({
    data: {
      requirementId,
      requirementVersionId: version.id,
      provider: "groq",
      model: env.GROQ_MODEL,
      status: AnalysisStatus.PROCESSING,
      promptSchemaVersion: ANALYSIS_PROMPT_SCHEMA_VERSION,
    },
    select: { id: true },
  });
  const job = await createAIJob({
    type: AIJobType.REQUIREMENT_ANALYSIS,
    userId,
    projectId: requirement.project.id,
    requirementId,
    analysisId: record.id,
    idempotencyKey: `${requirementId}:${version.id}:${force ? "force" : "reuse"}`,
    provider: "groq",
    model: env.GROQ_MODEL,
    promptSchemaVersion: ANALYSIS_PROMPT_SCHEMA_VERSION,
  });

  try {
    const result = await generateStructuredOutput({
      schemaName: "specforge_requirement_analysis",
      schema: aiAnalysisJsonSchema,
      system: ANALYSIS_SYSTEM_PROMPT,
      prompt: buildAnalysisPrompt({ projectName: requirement.project.name, requirementTitle: requirement.title, content: version.content }),
      parse: (value) => aiAnalysisOutputSchema.parse(value),
      maxOutputTokens: 5000,
    });

    const hasRequiredQuestions = result.data.clarificationQuestions.some((question) => question.required);
    const analysis = await prisma.$transaction(async (tx) => {
      if (hasRequiredQuestions && requirement.status !== RequirementStatus.NEEDS_CLARIFICATION) {
        await tx.requirement.update({ where: { id: requirementId }, data: { status: RequirementStatus.NEEDS_CLARIFICATION } });
      }
      return tx.aIAnalysis.update({
        where: { id: record.id },
        data: {
          status: AnalysisStatus.COMPLETED,
          clarificationQuestions: result.data.clarificationQuestions,
          functionalRequirements: result.data.functionalRequirements,
          nonFunctionalRequirements: result.data.nonFunctionalRequirements,
          userStories: result.data.userStories,
          technicalPlan: result.data.technicalPlan,
          risks: result.data.risks,
          rawOutput: result.data,
          errorMessage: null,
          errorCategory: null,
          attempts: result.telemetry.attempts,
          durationMs: result.telemetry.durationMs,
          promptTokens: result.usage?.prompt_tokens ?? null,
          completionTokens: result.usage?.completion_tokens ?? null,
          totalTokens: result.usage?.total_tokens ?? null,
        },
        select: analysisSelect,
      });
    });
    await completeAIJob(job.id, {
      attempts: result.telemetry.attempts,
      durationMs: result.telemetry.durationMs,
      promptTokens: result.usage?.prompt_tokens ?? null,
      completionTokens: result.usage?.completion_tokens ?? null,
      totalTokens: result.usage?.total_tokens ?? null,
      outputRef: analysis.id,
    });
    return { analysis, reused: false };
  } catch (error) {
    const telemetry = extractAIErrorTelemetry(error);

    await prisma.aIAnalysis.update({
      where: { id: record.id },
      data: {
        status: AnalysisStatus.FAILED,
        errorMessage: telemetry.message,
        errorCategory: telemetry.errorCategory,
        attempts: telemetry.attempts,
        durationMs: telemetry.durationMs ?? null,
      },
    });
    await failAIJob(job.id, {
      attempts: telemetry.attempts,
      durationMs: telemetry.durationMs ?? null,
      errorCategory: telemetry.errorCategory,
      errorMessage: telemetry.message,
    });
    throw error;
  }
}

export async function listAnalyses(userId: string, requirementId: string) {
  const requirement = await prisma.requirement.findFirst({ where: { id: requirementId, project: { workspace: { memberships: { some: { userId } } } } }, select: { id: true } });
  if (!requirement) throw new ApiError(404, "Requirement was not found");
  return prisma.aIAnalysis.findMany({ where: { requirementId }, select: analysisSelect, orderBy: { createdAt: "desc" } });
}

export async function getAnalysis(userId: string, analysisId: string) {
  const analysis = await prisma.aIAnalysis.findFirst({ where: { id: analysisId, requirement: { project: { workspace: { memberships: { some: { userId } } } } } }, select: analysisSelect });
  if (!analysis) throw new ApiError(404, "Analysis was not found");
  return analysis;
}
