import { createHash, randomBytes } from "node:crypto";
import type { WorkspaceRole } from "@prisma/client";
import { prisma } from "../../config/prisma.js";
import { ApiError } from "../../utils/api-error.js";
import { ADMIN_ROLES, WRITE_ROLES, assertRole, getProjectAccess, getWorkspaceAccess } from "../projects/project.access.js";
import type { AcceptProjectInvitationInput, CreateProjectInvitationInput, CreateTaskCommentInput, UpdateProjectMemberInput } from "./collaboration.schema.js";

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

function createMentionHandles(user: { name: string; email: string }) {
  const emailHandle = user.email.split("@")[0]?.toLowerCase() ?? "";
  const nameHandle = user.name.toLowerCase().replace(/[^a-z0-9]/g, "");

  return new Set([emailHandle, nameHandle].filter(Boolean));
}

function extractMentionTokens(body: string) {
  return new Set([...body.matchAll(/@([a-z0-9._-]+)/gi)].map((match) => match[1]?.toLowerCase()).filter((token): token is string => Boolean(token)));
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
  const mentionTokens = extractMentionTokens(input.body);
  const mentionedMembers = mentionTokens.size === 0
    ? []
    : await prisma.workspaceMember.findMany({
        where: { workspaceId: access.workspaceId, userId: { not: userId } },
        select: { userId: true, user: { select: { name: true, email: true } } },
      });
  const mentionedUserIds = mentionedMembers
    .filter((member) => [...createMentionHandles(member.user)].some((handle) => mentionTokens.has(handle)))
    .map((member) => member.userId);

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
        metadata: { commentId: comment.id, taskTitle: task.title, mentionedUserIds },
      },
    });

    if (mentionedUserIds.length > 0) {
      await tx.notification.createMany({
        data: mentionedUserIds.map((mentionedUserId) => ({
          userId: mentionedUserId,
          projectId: task.projectId,
          title: "You were mentioned in a task comment",
          body: task.title,
          metadata: { taskId, commentId: comment.id },
        })),
      });
    }

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

async function assertCanChangeMember(userId: string, projectId: string, memberId: string) {
  const access = await getProjectAccess(userId, projectId);
  assertRole(access.role, ADMIN_ROLES, "Only admins can manage project members");

  const member = await prisma.workspaceMember.findFirst({
    where: { id: memberId, workspaceId: access.workspaceId },
    select: { id: true, userId: true, role: true, workspaceId: true },
  });
  if (!member) throw new ApiError(404, "Workspace member was not found");

  if (member.userId === userId) throw new ApiError(409, "You cannot change your own membership");

  return { access, member };
}

async function assertOwnerWillRemain(workspaceId: string, memberId: string) {
  const ownerCount = await prisma.workspaceMember.count({
    where: { workspaceId, role: "OWNER", id: { not: memberId } },
  });
  if (ownerCount === 0) throw new ApiError(409, "At least one workspace owner must remain");
}

export async function updateProjectMember(userId: string, projectId: string, memberId: string, input: UpdateProjectMemberInput) {
  const { access, member } = await assertCanChangeMember(userId, projectId, memberId);
  if (member.role === "OWNER") await assertOwnerWillRemain(access.workspaceId, memberId);

  return prisma.$transaction(async (tx) => {
    const updated = await tx.workspaceMember.update({
      where: { id: memberId },
      data: { role: input.role as WorkspaceRole },
      select: memberSelect,
    });

    await tx.projectActivity.create({
      data: {
        projectId,
        actorId: userId,
        action: "MEMBER_ROLE_UPDATED",
        entityType: "WORKSPACE_MEMBER",
        entityId: memberId,
        metadata: { role: input.role, userId: member.userId },
      },
    });

    return updated;
  });
}

export async function removeProjectMember(userId: string, projectId: string, memberId: string) {
  const { access, member } = await assertCanChangeMember(userId, projectId, memberId);
  if (member.role === "OWNER") await assertOwnerWillRemain(access.workspaceId, memberId);

  await prisma.$transaction(async (tx) => {
    await tx.workspaceMember.delete({ where: { id: memberId } });
    await tx.projectActivity.create({
      data: {
        projectId,
        actorId: userId,
        action: "MEMBER_REMOVED",
        entityType: "WORKSPACE_MEMBER",
        entityId: memberId,
        metadata: { userId: member.userId },
      },
    });
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
