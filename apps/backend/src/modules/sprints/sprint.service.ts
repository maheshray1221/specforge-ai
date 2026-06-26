import { SprintStatus, TaskStatus } from "@prisma/client";
import { prisma } from "../../config/prisma.js";
import { ApiError } from "../../utils/api-error.js";
import { WRITE_ROLES, assertRole, getProjectAccess } from "../projects/project.access.js";
import type { CreateSprintInput, UpdateSprintInput } from "./sprint.schema.js";

const select = {
  id: true,
  projectId: true,
  name: true,
  goal: true,
  status: true,
  startDate: true,
  endDate: true,
  capacityPoints: true,
  createdAt: true,
  updatedAt: true,
  tasks: {
    select: { id: true, title: true, type: true, priority: true, status: true, storyPoints: true },
    orderBy: { position: "asc" as const },
  },
} as const;

const toDate = (value: string | null): Date | null => value === null ? null : new Date(value);

export async function createSprint(userId: string, projectId: string, input: CreateSprintInput) {
  const access = await getProjectAccess(userId, projectId);
  assertRole(access.role, WRITE_ROLES, "Viewer members cannot create sprints");
  return prisma.sprint.create({
    data: {
      projectId,
      name: input.name,
      ...(input.goal !== undefined ? { goal: input.goal } : {}),
      ...(input.startDate !== undefined ? { startDate: toDate(input.startDate) } : {}),
      ...(input.endDate !== undefined ? { endDate: toDate(input.endDate) } : {}),
      ...(input.capacityPoints !== undefined ? { capacityPoints: input.capacityPoints } : {}),
    },
    select,
  });
}

export async function listSprints(userId: string, projectId: string) {
  await getProjectAccess(userId, projectId);
  return prisma.sprint.findMany({ where: { projectId }, select, orderBy: [{ status: "asc" }, { createdAt: "desc" }] });
}

export async function updateSprint(userId: string, sprintId: string, input: UpdateSprintInput) {
  const sprint = await prisma.sprint.findUnique({ where: { id: sprintId }, select: { projectId: true, startDate: true, endDate: true, status: true } });
  if (!sprint) throw new ApiError(404, "Sprint was not found");
  const access = await getProjectAccess(userId, sprint.projectId);
  assertRole(access.role, WRITE_ROLES, "Viewer members cannot update sprints");

  const startDate = input.startDate !== undefined ? toDate(input.startDate) : sprint.startDate;
  const endDate = input.endDate !== undefined ? toDate(input.endDate) : sprint.endDate;
  if (startDate && endDate && startDate > endDate) throw new ApiError(422, "End date must be after start date");

  if (input.status === SprintStatus.ACTIVE) {
    const active = await prisma.sprint.findFirst({ where: { projectId: sprint.projectId, status: SprintStatus.ACTIVE, id: { not: sprintId } }, select: { id: true } });
    if (active) throw new ApiError(409, "Only one sprint can be active in a project");
  }
  if (input.status === SprintStatus.COMPLETED) {
    const unfinished = await prisma.task.count({ where: { sprintId, status: { not: TaskStatus.DONE } } });
    if (unfinished > 0) throw new ApiError(409, "Complete all sprint tasks before closing the sprint");
  }

  return prisma.sprint.update({
    where: { id: sprintId },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.goal !== undefined ? { goal: input.goal } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.startDate !== undefined ? { startDate: toDate(input.startDate) } : {}),
      ...(input.endDate !== undefined ? { endDate: toDate(input.endDate) } : {}),
      ...(input.capacityPoints !== undefined ? { capacityPoints: input.capacityPoints } : {}),
    },
    select,
  });
}

export async function addTask(userId: string, sprintId: string, taskId: string) {
  const sprint = await prisma.sprint.findUnique({ where: { id: sprintId }, select: { projectId: true, status: true, capacityPoints: true, tasks: { select: { storyPoints: true } } } });
  if (!sprint) throw new ApiError(404, "Sprint was not found");
  if (sprint.status === SprintStatus.COMPLETED) throw new ApiError(409, "Completed sprints cannot be changed");
  const access = await getProjectAccess(userId, sprint.projectId);
  assertRole(access.role, WRITE_ROLES, "Viewer members cannot plan sprints");
  const task = await prisma.task.findUnique({ where: { id: taskId }, select: { projectId: true, storyPoints: true, sprintId: true } });
  if (!task || task.projectId !== sprint.projectId) throw new ApiError(422, "Task must belong to the same project");
  if (task.sprintId === sprintId) return prisma.sprint.findUniqueOrThrow({ where: { id: sprintId }, select });
  const planned = sprint.tasks.reduce((sum, item) => sum + (item.storyPoints ?? 0), 0) + (task.storyPoints ?? 0);
  if (sprint.capacityPoints && planned > sprint.capacityPoints) throw new ApiError(409, "Sprint capacity would be exceeded");
  await prisma.task.update({ where: { id: taskId }, data: { sprintId, status: TaskStatus.TODO } });
  return prisma.sprint.findUniqueOrThrow({ where: { id: sprintId }, select });
}

export async function removeTask(userId: string, sprintId: string, taskId: string) {
  const sprint = await prisma.sprint.findUnique({ where: { id: sprintId }, select: { projectId: true, status: true } });
  if (!sprint) throw new ApiError(404, "Sprint was not found");
  const access = await getProjectAccess(userId, sprint.projectId);
  assertRole(access.role, WRITE_ROLES, "Viewer members cannot plan sprints");
  await prisma.task.updateMany({ where: { id: taskId, sprintId, projectId: sprint.projectId }, data: { sprintId: null, status: TaskStatus.BACKLOG } });
  return prisma.sprint.findUniqueOrThrow({ where: { id: sprintId }, select });
}
