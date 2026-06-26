import { ProjectStatus } from "@prisma/client";
import { prisma } from "../../config/prisma.js";
import { ApiError } from "../../utils/api-error.js";
import { ADMIN_ROLES, WRITE_ROLES, assertRole, getProjectAccess, getWorkspaceAccess } from "./project.access.js";
import type { CreateProjectInput, ListProjectsQuery, UpdateProjectInput } from "./project.schema.js";

const select = {
  id: true,
  workspaceId: true,
  name: true,
  key: true,
  description: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { requirements: true, tasks: true, sprints: true } },
} as const;

export async function createProject(userId: string, input: CreateProjectInput) {
  const access = await getWorkspaceAccess(userId, input.workspaceId);
  assertRole(access.role, WRITE_ROLES, "Viewer members cannot create projects");
  return prisma.project.create({ data: input, select });
}

export async function listProjects(userId: string, query: ListProjectsQuery) {
  await getWorkspaceAccess(userId, query.workspaceId);
  return prisma.project.findMany({
    where: {
      workspaceId: query.workspaceId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.search ? { OR: [
        { name: { contains: query.search, mode: "insensitive" } },
        { key: { contains: query.search, mode: "insensitive" } },
      ] } : {}),
    },
    select,
    orderBy: { updatedAt: "desc" },
  });
}

export async function getProject(userId: string, projectId: string) {
  await getProjectAccess(userId, projectId);
  const project = await prisma.project.findUnique({ where: { id: projectId }, select });
  if (!project) throw new ApiError(404, "Project was not found");
  return project;
}

export async function updateProject(userId: string, projectId: string, input: UpdateProjectInput) {
  const access = await getProjectAccess(userId, projectId);
  assertRole(access.role, WRITE_ROLES, "Viewer members cannot update projects");
  return prisma.project.update({ where: { id: projectId }, data: input, select });
}

export async function archiveProject(userId: string, projectId: string) {
  const access = await getProjectAccess(userId, projectId);
  assertRole(access.role, ADMIN_ROLES, "Only owners or admins can archive projects");
  return prisma.project.update({ where: { id: projectId }, data: { status: ProjectStatus.ARCHIVED }, select });
}
