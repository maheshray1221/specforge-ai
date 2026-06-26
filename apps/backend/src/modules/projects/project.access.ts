import { WorkspaceRole } from "@prisma/client";
import { prisma } from "../../config/prisma.js";
import { ApiError } from "../../utils/api-error.js";

export const WRITE_ROLES = [WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.MEMBER] as const;
export const ADMIN_ROLES = [WorkspaceRole.OWNER, WorkspaceRole.ADMIN] as const;

export function assertRole(role: WorkspaceRole, allowed: readonly WorkspaceRole[], message = "Insufficient permission"): void {
  if (!allowed.includes(role)) throw new ApiError(403, message);
}

export async function getWorkspaceAccess(userId: string, workspaceId: string) {
  const membership = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
    select: { role: true, workspace: { select: { id: true, name: true } } },
  });
  if (!membership) throw new ApiError(404, "Workspace was not found");
  return membership;
}

export async function getProjectAccess(userId: string, projectId: string) {
  const project = await prisma.project.findFirst({
    where: { id: projectId, workspace: { memberships: { some: { userId } } } },
    select: { id: true, workspaceId: true, status: true, workspace: { select: { memberships: { where: { userId }, select: { role: true }, take: 1 } } } },
  });
  if (!project) throw new ApiError(404, "Project was not found");
  const role = project.workspace.memberships[0]?.role;
  if (!role) throw new ApiError(403, "Project access denied");
  return { projectId: project.id, workspaceId: project.workspaceId, status: project.status, role };
}
