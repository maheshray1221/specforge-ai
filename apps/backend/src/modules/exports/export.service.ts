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
