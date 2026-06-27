import { AnalysisStatus, ProjectStatus, RequirementStatus, TaskStatus } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import { prisma } from "../../config/prisma.js";
import { generateStructuredOutput } from "../../lib/ai/groq.client.js";
import { ApiError } from "../../utils/api-error.js";
import { aiAnalysisOutputSchema } from "../ai-analysis/ai-analysis.output.js";
import { WRITE_ROLES, assertRole, getProjectAccess } from "../projects/project.access.js";
import { taskGeneratorJsonSchema, taskGeneratorOutputSchema } from "./task-generator.output.js";
import { TASK_SYSTEM_PROMPT, buildTaskPrompt } from "./task-generator.prompt.js";
import type { UpdateTaskInput } from "./task.schema.js";

const taskSelect = {
  id: true,
  projectId: true,
  requirementId: true,
  analysisId: true,
  sprintId: true,
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
} as const;

const normalizeLabels = (labels: string[]) => [...new Set(labels.map((label) => label.trim().toLowerCase()).filter(Boolean))].slice(0, 20);

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
  if (analysis.requirement.status === RequirementStatus.NEEDS_CLARIFICATION) throw new ApiError(409, "Resolve clarification questions and mark the requirement READY first");
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

  const result = await generateStructuredOutput({
    schemaName: "specforge_task_backlog",
    schema: taskGeneratorJsonSchema,
    system: TASK_SYSTEM_PROMPT,
    prompt: buildTaskPrompt({ projectName: analysis.requirement.project.name, requirementTitle: analysis.requirement.title, requirementContent: analysis.requirementVersion.content, analysis: stored.data }),
    parse: (value) => taskGeneratorOutputSchema.parse(value),
    maxOutputTokens: 16000,
  });

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
  });

  const tasks = await prisma.task.findMany({ where: { analysisId }, select: taskSelect, orderBy: { position: "asc" } });
  return { tasks, generationNotes: result.data.generationNotes, reused: false };
}

export async function listProjectTasks(userId: string, projectId: string, filters: { status?: string; type?: string; sprintId?: string }) {
  await getProjectAccess(userId, projectId);
  return prisma.task.findMany({
    where: {
      projectId,
      ...(filters.status ? { status: filters.status as never } : {}),
      ...(filters.type ? { type: filters.type as never } : {}),
      ...(filters.sprintId ? { sprintId: filters.sprintId } : {}),
    },
    select: taskSelect,
    orderBy: [{ status: "asc" }, { position: "asc" }, { createdAt: "asc" }],
  });
}

export async function updateTask(userId: string, taskId: string, input: UpdateTaskInput) {
  const task = await prisma.task.findUnique({ where: { id: taskId }, select: { projectId: true } });
  if (!task) throw new ApiError(404, "Task was not found");
  const access = await getProjectAccess(userId, task.projectId);
  assertRole(access.role, WRITE_ROLES, "Viewer members cannot update tasks");
  if (input.sprintId) {
    const sprint = await prisma.sprint.findFirst({ where: { id: input.sprintId, projectId: task.projectId }, select: { id: true } });
    if (!sprint) throw new ApiError(422, "Sprint must belong to the same project");
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
  };
  return prisma.task.update({ where: { id: taskId }, data, select: taskSelect });
}
