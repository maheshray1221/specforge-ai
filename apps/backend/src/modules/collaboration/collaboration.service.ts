import { createHash, randomBytes } from "node:crypto";
import type { WorkspaceRole } from "@prisma/client";
import { prisma } from "../../config/prisma.js";
import { ApiError } from "../../utils/api-error.js";
import { ADMIN_ROLES, WRITE_ROLES, assertRole, getProjectAccess, getWorkspaceAccess } from "../projects/project.access.js";
import type { AcceptProjectInvitationInput, CreateProjectInvitationInput, CreateTaskCommentInput } from "./collaboration.schema.js";

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

const invitationSelect = {
  id: true,
  workspaceId: true,
  email: true,
  role: true,
  acceptedAt: true,
  cancelledAt: true,
  expiresAt: true,
  createdAt: true,
  invitedBy: { select: { id: true, name: true, email: true } },
} as const;

const memberSelect = {
  id: true,
  role: true,
  createdAt: true,
  user: { select: { id: true, name: true, email: true } },
} as const;

function hashInvitationToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

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

export async function listProjectMembers(userId: string, projectId: string) {
  const access = await getProjectAccess(userId, projectId);

  return prisma.workspaceMember.findMany({
    where: { workspaceId: access.workspaceId },
    select: memberSelect,
    orderBy: [{ role: "asc" }, { createdAt: "asc" }],
  });
}

export async function listProjectInvitations(userId: string, projectId: string) {
  const access = await getProjectAccess(userId, projectId);
  assertRole(access.role, ADMIN_ROLES, "Only admins can view project invitations");

  return prisma.workspaceInvitation.findMany({
    where: { workspaceId: access.workspaceId },
    select: invitationSelect,
    orderBy: [{ createdAt: "desc" }],
    take: 100,
  });
}

export async function createProjectInvitation(userId: string, projectId: string, input: CreateProjectInvitationInput) {
  const access = await getProjectAccess(userId, projectId);
  assertRole(access.role, ADMIN_ROLES, "Only admins can invite workspace members");

  const email = input.email.toLowerCase();
  const existingUser = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existingUser) {
    const existingMember = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId: access.workspaceId, userId: existingUser.id } },
      select: { id: true },
    });
    if (existingMember) throw new ApiError(409, "User is already a workspace member");
  }

  const activeInvitation = await prisma.workspaceInvitation.findFirst({
    where: {
      workspaceId: access.workspaceId,
      email,
      acceptedAt: null,
      cancelledAt: null,
      expiresAt: { gt: new Date() },
    },
    select: { id: true },
  });
  if (activeInvitation) throw new ApiError(409, "An active invitation already exists for this email");

  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + input.expiresInDays * 24 * 60 * 60 * 1000);

  const invitation = await prisma.$transaction(async (tx) => {
    const created = await tx.workspaceInvitation.create({
      data: {
        workspaceId: access.workspaceId,
        email,
        role: input.role as WorkspaceRole,
        tokenHash: hashInvitationToken(token),
        invitedById: userId,
        expiresAt,
      },
      select: invitationSelect,
    });

    await tx.projectActivity.create({
      data: {
        projectId,
        actorId: userId,
        action: "MEMBER_INVITED",
        entityType: "WORKSPACE_INVITATION",
        entityId: created.id,
        metadata: { email, role: input.role },
      },
    });

    return created;
  });

  return { ...invitation, acceptanceToken: token };
}

export async function cancelProjectInvitation(userId: string, invitationId: string) {
  const invitation = await prisma.workspaceInvitation.findUnique({
    where: { id: invitationId },
    select: { id: true, workspaceId: true, acceptedAt: true, cancelledAt: true },
  });
  if (!invitation) throw new ApiError(404, "Invitation was not found");

  const access = await getWorkspaceAccess(userId, invitation.workspaceId);
  assertRole(access.role, ADMIN_ROLES, "Only admins can cancel invitations");
  if (invitation.acceptedAt) throw new ApiError(409, "Accepted invitations cannot be cancelled");
  if (invitation.cancelledAt) throw new ApiError(409, "Invitation is already cancelled");

  return prisma.workspaceInvitation.update({
    where: { id: invitationId },
    data: { cancelledAt: new Date() },
    select: invitationSelect,
  });
}

export async function acceptProjectInvitation(userId: string, input: AcceptProjectInvitationInput) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true } });
  if (!user) throw new ApiError(404, "User was not found");

  const invitation = await prisma.workspaceInvitation.findUnique({
    where: { tokenHash: hashInvitationToken(input.token) },
    select: { id: true, workspaceId: true, email: true, role: true, acceptedAt: true, cancelledAt: true, expiresAt: true },
  });
  if (!invitation) throw new ApiError(404, "Invitation was not found");
  if (invitation.acceptedAt) throw new ApiError(409, "Invitation was already accepted");
  if (invitation.cancelledAt) throw new ApiError(409, "Invitation was cancelled");
  if (invitation.expiresAt <= new Date()) throw new ApiError(410, "Invitation has expired");
  if (invitation.email !== user.email.toLowerCase()) throw new ApiError(403, "Invitation email does not match current user");

  return prisma.$transaction(async (tx) => {
    await tx.workspaceInvitation.update({
      where: { id: invitation.id },
      data: { acceptedAt: new Date() },
    });

    return tx.workspaceMember.upsert({
      where: { workspaceId_userId: { workspaceId: invitation.workspaceId, userId } },
      update: { role: invitation.role },
      create: { workspaceId: invitation.workspaceId, userId, role: invitation.role },
      select: memberSelect,
    });
  });
}
