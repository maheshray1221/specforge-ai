import { AIJobType, AnalysisStatus, ProjectStatus, RequirementStatus, TaskStatus } from "@prisma/client";
import type { Prisma, TaskPriority, TaskType } from "@prisma/client";
import { prisma } from "../../config/prisma.js";
import { generateStructuredOutput } from "../../lib/ai/groq.client.js";
import { extractAIErrorTelemetry } from "../../lib/ai/telemetry.js";
import { ApiError } from "../../utils/api-error.js";
import { getPagination, getPaginationMeta } from "../../utils/pagination.js";
import { runAIJobInBackground } from "../ai-jobs/ai-job.runner.js";
import { completeAIJob, createAIJob, enqueueAIJob, failAIJob } from "../ai-jobs/ai-job.service.js";
import { aiAnalysisOutputSchema } from "../ai-analysis/ai-analysis.output.js";
import { WRITE_ROLES, assertRole, getProjectAccess } from "../projects/project.access.js";
import { assertProjectAIQuota } from "../usage/usage.service.js";
import { taskGeneratorJsonSchema, taskGeneratorOutputSchema } from "./task-generator.output.js";
import { TASK_SYSTEM_PROMPT, buildTaskPrompt } from "./task-generator.prompt.js";
import type { UpdateTaskInput } from "./task.schema.js";

const taskSelect = {
  id: true,
  projectId: true,
  requirementId: true,
  analysisId: true,
  sprintId: true,
  assigneeId: true,
  title: true,
  description: true,
  type: true,
  priority: true,
  status: true,
  storyPoints: true,
  acceptanceCriteria: true,
  labels: true,
  position: true,
  createdAt: true,
  updatedAt: true,
  sprint: { select: { id: true, name: true, status: true } },
  assignee: { select: { id: true, name: true, email: true } },
} as const;

const normalizeLabels = (labels: string[]) => [...new Set(labels.map((label) => label.trim().toLowerCase()).filter(Boolean))].slice(0, 20);

export async function queueTaskGeneration(userId: string, analysisId: string, regenerate: boolean) {
  const analysis = await prisma.aIAnalysis.findFirst({
    where: { id: analysisId, requirement: { project: { workspace: { memberships: { some: { userId } } } } } },
    select: {
      id: true,
      status: true,
      clarificationQuestions: true,
      functionalRequirements: true,
      nonFunctionalRequirements: true,
      userStories: true,
      technicalPlan: true,
      risks: true,
      requirementVersion: { select: { id: true } },
      requirement: { select: { id: true, status: true, project: { select: { id: true, status: true } }, versions: { orderBy: { versionNumber: "desc" }, take: 1, select: { id: true } } } },
    },
  });
  if (!analysis) throw new ApiError(404, "Analysis was not found");
  const access = await getProjectAccess(userId, analysis.requirement.project.id);
  assertRole(access.role, WRITE_ROLES, "Viewer members cannot generate tasks");
  if (analysis.status !== AnalysisStatus.COMPLETED) throw new ApiError(409, "Tasks require a completed analysis");
  if (analysis.requirement.project.status === ProjectStatus.ARCHIVED) throw new ApiError(409, "Archived projects cannot be changed");
  if (analysis.requirement.status !== RequirementStatus.APPROVED) throw new ApiError(409, "Approve the requirement before generating tasks");
  if (analysis.requirement.versions[0]?.id !== analysis.requirementVersion.id) throw new ApiError(409, "Analysis is not based on the latest requirement version");

  const stored = aiAnalysisOutputSchema.safeParse({
    clarificationQuestions: analysis.clarificationQuestions,
    functionalRequirements: analysis.functionalRequirements,
    nonFunctionalRequirements: analysis.nonFunctionalRequirements,
    userStories: analysis.userStories,
    technicalPlan: analysis.technicalPlan,
    risks: analysis.risks,
  });
  if (!stored.success) throw new ApiError(409, "Stored analysis is incomplete or invalid");

  const existing = await prisma.task.findMany({ where: { analysisId }, select: taskSelect, orderBy: { position: "asc" } });
  if (existing.length && !regenerate) return { tasks: existing, generationNotes: [], reused: true, queued: false };
  if (regenerate) {
    const locked = await prisma.task.findFirst({ where: { analysisId, OR: [{ status: { not: TaskStatus.BACKLOG } }, { sprintId: { not: null } }] }, select: { id: true } });
    if (locked) throw new ApiError(409, "Tasks cannot be regenerated after sprint planning or work has started");
  }
  await assertProjectAIQuota(userId, analysis.requirement.project.id);

  const job = await enqueueAIJob({
    type: AIJobType.TASK_GENERATION,
    userId,
    projectId: analysis.requirement.project.id,
    requirementId: analysis.requirement.id,
    analysisId,
    idempotencyKey: `${analysisId}:${regenerate ? "regenerate" : "generate"}`,
    provider: "groq",
    model: "task-generator",
    promptSchemaVersion: "task-backlog:v1",
  });

  runAIJobInBackground({
    jobId: job.id,
    jobName: "task-generation",
    run: async () => {
      await generateTasks(userId, analysisId, regenerate);
    },
  });

  return { job, queued: true };
}

export async function generateTasks(userId: string, analysisId: string, regenerate: boolean) {
  const analysis = await prisma.aIAnalysis.findFirst({
    where: { id: analysisId, requirement: { project: { workspace: { memberships: { some: { userId } } } } } },
    select: {
      id: true,
      status: true,
      clarificationQuestions: true,
      functionalRequirements: true,
      nonFunctionalRequirements: true,
      userStories: true,
      technicalPlan: true,
      risks: true,
      requirementVersion: { select: { id: true, content: true } },
      requirement: { select: { id: true, title: true, status: true, project: { select: { id: true, name: true, status: true } }, versions: { orderBy: { versionNumber: "desc" }, take: 1, select: { id: true } } } },
    },
  });
  if (!analysis) throw new ApiError(404, "Analysis was not found");
  const access = await getProjectAccess(userId, analysis.requirement.project.id);
  assertRole(access.role, WRITE_ROLES, "Viewer members cannot generate tasks");
  if (analysis.status !== AnalysisStatus.COMPLETED) throw new ApiError(409, "Tasks require a completed analysis");
  if (analysis.requirement.project.status === ProjectStatus.ARCHIVED) throw new ApiError(409, "Archived projects cannot be changed");
  if (analysis.requirement.status !== RequirementStatus.APPROVED) throw new ApiError(409, "Approve the requirement before generating tasks");
  if (analysis.requirement.versions[0]?.id !== analysis.requirementVersion.id) throw new ApiError(409, "Analysis is not based on the latest requirement version");

  const stored = aiAnalysisOutputSchema.safeParse({
    clarificationQuestions: analysis.clarificationQuestions,
    functionalRequirements: analysis.functionalRequirements,
    nonFunctionalRequirements: analysis.nonFunctionalRequirements,
    userStories: analysis.userStories,
    technicalPlan: analysis.technicalPlan,
    risks: analysis.risks,
  });
  if (!stored.success) throw new ApiError(409, "Stored analysis is incomplete or invalid");

  const existing = await prisma.task.findMany({ where: { analysisId }, select: taskSelect, orderBy: { position: "asc" } });
  if (existing.length && !regenerate) return { tasks: existing, generationNotes: [], reused: true };
  if (regenerate) {
    const locked = await prisma.task.findFirst({ where: { analysisId, OR: [{ status: { not: TaskStatus.BACKLOG } }, { sprintId: { not: null } }] }, select: { id: true } });
    if (locked) throw new ApiError(409, "Tasks cannot be regenerated after sprint planning or work has started");
  }
  await assertProjectAIQuota(userId, analysis.requirement.project.id);

  const job = await createAIJob({
    type: AIJobType.TASK_GENERATION,
    userId,
    projectId: analysis.requirement.project.id,
    requirementId: analysis.requirement.id,
    analysisId,
    idempotencyKey: `${analysisId}:${regenerate ? "regenerate" : "generate"}`,
    provider: "groq",
    model: "task-generator",
    promptSchemaVersion: "task-backlog:v1",
  });

  let result: Awaited<ReturnType<typeof generateStructuredOutput<typeof taskGeneratorOutputSchema._output>>>;

  try {
    result = await generateStructuredOutput({
      schemaName: "specforge_task_backlog",
      schema: taskGeneratorJsonSchema,
      system: TASK_SYSTEM_PROMPT,
      prompt: buildTaskPrompt({ projectName: analysis.requirement.project.name, requirementTitle: analysis.requirement.title, requirementContent: analysis.requirementVersion.content, analysis: stored.data }),
      parse: (value) => taskGeneratorOutputSchema.parse(value),
      // Keep the combined prompt and completion below Groq's 8K TPM limit
      // on the default on-demand tier.
      maxOutputTokens: 5000,
    });
  } catch (error) {
    const telemetry = extractAIErrorTelemetry(error);

    await prisma.aIAnalysis.update({
      where: { id: analysisId },
      data: {
        taskGenerationAttempts: telemetry.attempts,
        taskGenerationDurationMs: telemetry.durationMs ?? null,
        taskGenerationErrorCategory: telemetry.errorCategory,
        taskGenerationErrorMessage: telemetry.message,
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

  await prisma.$transaction(async (tx) => {
    if (regenerate) await tx.task.deleteMany({ where: { analysisId } });
    await tx.task.createMany({
      data: result.data.tasks.map((task, position) => ({
        projectId: analysis.requirement.project.id,
        requirementId: analysis.requirement.id,
        analysisId,
        createdById: userId,
        title: task.title,
        description: task.dependencies.length
          ? `${task.description}\n\nDependencies:\n${task.dependencies.map((item) => `- ${item}`).join("\n")}`
          : task.description,
        type: task.type,
        priority: task.priority,
        storyPoints: task.storyPoints,
        acceptanceCriteria: task.acceptanceCriteria,
        labels: normalizeLabels([...task.labels, ...task.sourceUserStoryIds.map((id) => `story:${id}`)]),
        position,
      })),
    });
    await tx.aIAnalysis.update({
      where: { id: analysisId },
      data: {
        taskGenerationAttempts: result.telemetry.attempts,
        taskGenerationDurationMs: result.telemetry.durationMs,
        taskGenerationPromptTokens: result.usage?.prompt_tokens ?? null,
        taskGenerationCompletionTokens: result.usage?.completion_tokens ?? null,
        taskGenerationTotalTokens: result.usage?.total_tokens ?? null,
        taskGenerationErrorCategory: null,
        taskGenerationErrorMessage: null,
      },
    });
  });
  await completeAIJob(job.id, {
    attempts: result.telemetry.attempts,
    durationMs: result.telemetry.durationMs,
    promptTokens: result.usage?.prompt_tokens ?? null,
    completionTokens: result.usage?.completion_tokens ?? null,
    totalTokens: result.usage?.total_tokens ?? null,
    outputRef: analysisId,
  });

  const tasks = await prisma.task.findMany({ where: { analysisId }, select: taskSelect, orderBy: { position: "asc" } });
  return { tasks, generationNotes: result.data.generationNotes, reused: false };
}

export async function listProjectTasks(
  userId: string,
  projectId: string,
  filters: {
    status?: TaskStatus;
    type?: TaskType;
    priority?: TaskPriority;
    sprintId?: string;
    search?: string;
    page?: number;
    limit?: number;
  },
) {
  await getProjectAccess(userId, projectId);
  const pagination = getPagination(filters);
  const where: Prisma.TaskWhereInput = {
    projectId,
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.type ? { type: filters.type } : {}),
    ...(filters.priority ? { priority: filters.priority } : {}),
    ...(filters.sprintId ? { sprintId: filters.sprintId } : {}),
    ...(filters.search
      ? {
          OR: [
            { title: { contains: filters.search, mode: "insensitive" } },
            { description: { contains: filters.search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [tasks, total] = await prisma.$transaction([
    prisma.task.findMany({
      where,
      select: taskSelect,
      orderBy: [{ status: "asc" }, { position: "asc" }, { createdAt: "asc" }],
      skip: pagination.skip,
      take: pagination.take,
    }),
    prisma.task.count({ where }),
  ]);

  return {
    tasks,
    pagination: getPaginationMeta({
      page: pagination.page,
      limit: pagination.limit,
      total,
    }),
  };
}

export async function updateTask(userId: string, taskId: string, input: UpdateTaskInput) {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { projectId: true, sprint: { select: { status: true } } },
  });
  if (!task) throw new ApiError(404, "Task was not found");
  const access = await getProjectAccess(userId, task.projectId);
  assertRole(access.role, WRITE_ROLES, "Viewer members cannot update tasks");
  if (task.sprint?.status === "COMPLETED") throw new ApiError(409, "Tasks in completed sprints are read-only");
  if (input.sprintId) {
    const sprint = await prisma.sprint.findFirst({ where: { id: input.sprintId, projectId: task.projectId }, select: { id: true } });
    if (!sprint) throw new ApiError(422, "Sprint must belong to the same project");
  }
  if (input.assigneeId) {
    const assignee = await prisma.workspaceMember.findFirst({
      where: {
        userId: input.assigneeId,
        workspace: { projects: { some: { id: task.projectId } } },
      },
      select: { id: true },
    });
    if (!assignee) throw new ApiError(422, "Assignee must belong to the project workspace");
  }
  const data: Prisma.TaskUpdateInput = {
    ...(input.title !== undefined ? { title: input.title } : {}),
    ...(input.description !== undefined ? { description: input.description } : {}),
    ...(input.type !== undefined ? { type: input.type } : {}),
    ...(input.priority !== undefined ? { priority: input.priority } : {}),
    ...(input.status !== undefined ? { status: input.status } : {}),
    ...(input.storyPoints !== undefined ? { storyPoints: input.storyPoints } : {}),
    ...(input.labels !== undefined ? { labels: normalizeLabels(input.labels) } : {}),
    ...(input.sprintId !== undefined ? { sprint: input.sprintId ? { connect: { id: input.sprintId } } : { disconnect: true } } : {}),
    ...(input.assigneeId !== undefined ? { assignee: input.assigneeId ? { connect: { id: input.assigneeId } } : { disconnect: true } } : {}),
  };
  return prisma.$transaction(async (tx) => {
    const updated = await tx.task.update({ where: { id: taskId }, data, select: taskSelect });
    if (input.assigneeId !== undefined) {
      await tx.projectActivity.create({
        data: {
          projectId: task.projectId,
          actorId: userId,
          action: input.assigneeId ? "TASK_ASSIGNED" : "TASK_UNASSIGNED",
          entityType: "TASK",
          entityId: taskId,
          metadata: { assigneeId: input.assigneeId },
        },
      });
      if (input.assigneeId && input.assigneeId !== userId) {
        await tx.notification.create({
          data: {
            userId: input.assigneeId,
            projectId: task.projectId,
            title: "You were assigned a task",
            body: updated.title,
            metadata: { taskId },
          },
        });
      }
    }
    return updated;
  });
}
