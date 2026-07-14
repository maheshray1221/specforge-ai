import { prisma } from "../../config/prisma.js";
import { ApiError } from "../../utils/api-error.js";
import { WRITE_ROLES, assertRole, getProjectAccess } from "../projects/project.access.js";
import type { CreateTaskCommentInput } from "./collaboration.schema.js";

const commentSelect = {
  id: true,
  taskId: true,
  projectId: true,
  body: true,
  createdAt: true,
  updatedAt: true,
  author: { select: { id: true, name: true, email: true } },
} as const;

const activitySelect = {
  id: true,
  projectId: true,
  action: true,
  entityType: true,
  entityId: true,
  metadata: true,
  createdAt: true,
  actor: { select: { id: true, name: true, email: true } },
} as const;

export async function listTaskComments(userId: string, taskId: string) {
  const task = await prisma.task.findFirst({
    where: { id: taskId, project: { workspace: { memberships: { some: { userId } } } } },
    select: { id: true },
  });
  if (!task) throw new ApiError(404, "Task was not found");

  return prisma.taskComment.findMany({
    where: { taskId },
    select: commentSelect,
    orderBy: { createdAt: "asc" },
  });
}

export async function createTaskComment(userId: string, taskId: string, input: CreateTaskCommentInput) {
  const task = await prisma.task.findFirst({
    where: { id: taskId, project: { workspace: { memberships: { some: { userId } } } } },
    select: { id: true, projectId: true, title: true },
  });
  if (!task) throw new ApiError(404, "Task was not found");

  const access = await getProjectAccess(userId, task.projectId);
  assertRole(access.role, WRITE_ROLES, "Viewer members cannot comment on tasks");

  return prisma.$transaction(async (tx) => {
    const comment = await tx.taskComment.create({
      data: {
        taskId,
        projectId: task.projectId,
        authorId: userId,
        body: input.body,
      },
      select: commentSelect,
    });

    await tx.projectActivity.create({
      data: {
        projectId: task.projectId,
        actorId: userId,
        action: "TASK_COMMENTED",
        entityType: "TASK",
        entityId: taskId,
        metadata: { commentId: comment.id, taskTitle: task.title },
      },
    });

    return comment;
  });
}

export async function listProjectActivity(userId: string, projectId: string, limit: number) {
  await getProjectAccess(userId, projectId);

  return prisma.projectActivity.findMany({
    where: { projectId },
    select: activitySelect,
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}
