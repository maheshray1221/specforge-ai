import { Prisma, ProjectStatus } from "@prisma/client";

import { prisma } from "../../config/prisma.js";
import { ApiError } from "../../utils/api-error.js";

import {
  ADMIN_ROLES,
  WRITE_ROLES,
  assertRole,
  getProjectAccess,
  getWorkspaceAccess,
} from "./project.access.js";

import type {
  CreateProjectInput,
  ListProjectsQuery,
  UpdateProjectInput,
} from "./project.schema.js";

const select = {
  id: true,
  workspaceId: true,
  name: true,
  key: true,
  description: true,
  status: true,
  createdAt: true,
  updatedAt: true,

  _count: {
    select: {
      requirements: true,
      tasks: true,
      sprints: true,
    },
  },
} satisfies Prisma.ProjectSelect;

export async function createProject(userId: string, input: CreateProjectInput) {
  const access = await getWorkspaceAccess(userId, input.workspaceId);

  assertRole(access.role, WRITE_ROLES, "Viewer members cannot create projects");

  /*
   * Optional properties ko tabhi Prisma data object me
   * add karo jab unki value undefined na ho.
   */
  const createData = {
    workspaceId: input.workspaceId,
    name: input.name,
    key: input.key,

    ...(input.description !== undefined
      ? {
          description: input.description,
        }
      : {}),
  } satisfies Prisma.ProjectUncheckedCreateInput;

  return prisma.project.create({
    data: createData,
    select,
  });
}

export async function listProjects(userId: string, query: ListProjectsQuery) {
  await getWorkspaceAccess(userId, query.workspaceId);

  const where = {
    workspaceId: query.workspaceId,

    ...(query.status !== undefined
      ? {
          status: query.status,
        }
      : {}),

    ...(query.search !== undefined && query.search.trim().length > 0
      ? {
          OR: [
            {
              name: {
                contains: query.search.trim(),
                mode: Prisma.QueryMode.insensitive,
              },
            },
            {
              key: {
                contains: query.search.trim(),
                mode: Prisma.QueryMode.insensitive,
              },
            },
          ],
        }
      : {}),
  } satisfies Prisma.ProjectWhereInput;

  return prisma.project.findMany({
    where,
    select,
    orderBy: {
      updatedAt: "desc",
    },
  });
}

export async function getProject(userId: string, projectId: string) {
  await getProjectAccess(userId, projectId);

  const project = await prisma.project.findUnique({
    where: {
      id: projectId,
    },
    select,
  });

  if (!project) {
    throw new ApiError(404, "Project was not found");
  }

  return project;
}

export async function updateProject(
  userId: string,
  projectId: string,
  input: UpdateProjectInput,
) {
  const access = await getProjectAccess(userId, projectId);

  assertRole(access.role, WRITE_ROLES, "Viewer members cannot update projects");

  /*
   * undefined fields Prisma update object me include nahi honge.
   * null description allowed hai, agar schema me nullable hai.
   */
  const updateData = {
    ...(input.name !== undefined
      ? {
          name: input.name,
        }
      : {}),

    ...(input.description !== undefined
      ? {
          description: input.description,
        }
      : {}),

    ...(input.status !== undefined
      ? {
          status: input.status,
        }
      : {}),
  } satisfies Prisma.ProjectUpdateInput;

  if (Object.keys(updateData).length === 0) {
    throw new ApiError(400, "At least one project field is required");
  }

  return prisma.project.update({
    where: {
      id: projectId,
    },
    data: updateData,
    select,
  });
}

export async function archiveProject(userId: string, projectId: string) {
  const access = await getProjectAccess(userId, projectId);

  assertRole(
    access.role,
    ADMIN_ROLES,
    "Only owners or admins can archive projects",
  );

  return prisma.project.update({
    where: {
      id: projectId,
    },
    data: {
      status: ProjectStatus.ARCHIVED,
    },
    select,
  });
}
