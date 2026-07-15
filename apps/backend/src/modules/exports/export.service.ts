import { Prisma } from "@prisma/client";
import type { TaskPriority, TaskStatus, TaskType } from "@prisma/client";
import { prisma } from "../../config/prisma.js";
import { toCsv } from "../../utils/csv.js";
import { getProjectAccess } from "../projects/project.access.js";

interface ExportProjectTasksFilters {
  status?: TaskStatus;
  type?: TaskType;
  priority?: TaskPriority;
  sprintId?: string;
  search?: string;
}

const taskExportColumns = [
  "id",
  "title",
  "description",
  "type",
  "priority",
  "status",
  "storyPoints",
  "labels",
  "requirementTitle",
  "sprintName",
  "createdAt",
  "updatedAt",
];

const sprintExportColumns = [
  "id",
  "name",
  "goal",
  "status",
  "startDate",
  "endDate",
  "capacityPoints",
  "taskCount",
  "totalStoryPoints",
  "doneTaskCount",
  "createdAt",
  "updatedAt",
];

export async function exportProjectTasksCsv(userId: string, projectId: string, filters: ExportProjectTasksFilters) {
  await getProjectAccess(userId, projectId);

  const tasks = await prisma.task.findMany({
    where: {
      projectId,
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.type ? { type: filters.type } : {}),
      ...(filters.priority ? { priority: filters.priority } : {}),
      ...(filters.sprintId ? { sprintId: filters.sprintId } : {}),
      ...(filters.search
        ? {
            OR: [
              { title: { contains: filters.search, mode: Prisma.QueryMode.insensitive } },
              { description: { contains: filters.search, mode: Prisma.QueryMode.insensitive } },
            ],
          }
        : {}),
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
      createdAt: true,
      updatedAt: true,
      requirement: { select: { title: true } },
      sprint: { select: { name: true } },
    },
    orderBy: [{ status: "asc" }, { position: "asc" }, { createdAt: "asc" }],
  });

  return toCsv(
    tasks.map((task) => ({
      id: task.id,
      title: task.title,
      description: task.description,
      type: task.type,
      priority: task.priority,
      status: task.status,
      storyPoints: task.storyPoints,
      labels: task.labels,
      requirementTitle: task.requirement?.title ?? "",
      sprintName: task.sprint?.name ?? "",
      createdAt: task.createdAt.toISOString(),
      updatedAt: task.updatedAt.toISOString(),
    })),
    taskExportColumns,
  );
}

export async function exportProjectSprintsCsv(userId: string, projectId: string) {
  await getProjectAccess(userId, projectId);

  const sprints = await prisma.sprint.findMany({
    where: { projectId },
    select: {
      id: true,
      name: true,
      goal: true,
      status: true,
      startDate: true,
      endDate: true,
      capacityPoints: true,
      createdAt: true,
      updatedAt: true,
      tasks: { select: { status: true, storyPoints: true } },
    },
    orderBy: [{ status: "asc" }, { startDate: "asc" }, { createdAt: "asc" }],
  });

  return toCsv(
    sprints.map((sprint) => ({
      id: sprint.id,
      name: sprint.name,
      goal: sprint.goal ?? "",
      status: sprint.status,
      startDate: sprint.startDate?.toISOString() ?? "",
      endDate: sprint.endDate?.toISOString() ?? "",
      capacityPoints: sprint.capacityPoints,
      taskCount: sprint.tasks.length,
      totalStoryPoints: sprint.tasks.reduce((sum, task) => sum + (task.storyPoints ?? 0), 0),
      doneTaskCount: sprint.tasks.filter((task) => task.status === "DONE").length,
      createdAt: sprint.createdAt.toISOString(),
      updatedAt: sprint.updatedAt.toISOString(),
    })),
    sprintExportColumns,
  );
}

export async function exportProjectPlanningJson(userId: string, projectId: string) {
  await getProjectAccess(userId, projectId);

  const project = await prisma.project.findUniqueOrThrow({
    where: { id: projectId },
    select: {
      id: true,
      name: true,
      key: true,
      description: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      requirements: {
        select: {
          id: true,
          title: true,
          status: true,
          currentContent: true,
          clarificationAnswers: true,
          createdAt: true,
          updatedAt: true,
          versions: {
            select: { id: true, versionNumber: true, content: true, createdAt: true },
            orderBy: { versionNumber: "desc" },
          },
          analyses: {
            select: {
              id: true,
              status: true,
              provider: true,
              model: true,
              promptSchemaVersion: true,
              clarificationQuestions: true,
              functionalRequirements: true,
              nonFunctionalRequirements: true,
              userStories: true,
              technicalPlan: true,
              risks: true,
              errorCategory: true,
              errorMessage: true,
              attempts: true,
              durationMs: true,
              totalTokens: true,
              createdAt: true,
              updatedAt: true,
            },
            orderBy: { createdAt: "desc" },
          },
        },
        orderBy: { createdAt: "desc" },
      },
      tasks: {
        select: {
          id: true,
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
          assignee: { select: { id: true, name: true, email: true } },
          sprint: { select: { id: true, name: true, status: true } },
        },
        orderBy: [{ status: "asc" }, { position: "asc" }, { createdAt: "asc" }],
      },
      sprints: {
        select: {
          id: true,
          name: true,
          goal: true,
          status: true,
          startDate: true,
          endDate: true,
          capacityPoints: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: [{ status: "asc" }, { startDate: "asc" }, { createdAt: "asc" }],
      },
    },
  });

  return {
    exportedAt: new Date().toISOString(),
    schemaVersion: "planning-package-v1",
    project,
  };
}
