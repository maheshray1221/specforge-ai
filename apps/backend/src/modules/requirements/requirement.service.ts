import { ProjectStatus } from "@prisma/client";
import { prisma } from "../../config/prisma.js";
import { ApiError } from "../../utils/api-error.js";
import { WRITE_ROLES, assertRole, getProjectAccess } from "../projects/project.access.js";
import type { CreateRequirementInput, UpdateRequirementInput } from "./requirement.schema.js";

const select = {
  id: true,
  projectId: true,
  title: true,
  currentContent: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  versions: {
    orderBy: { versionNumber: "desc" as const },
    take: 5,
    select: { id: true, versionNumber: true, content: true, createdAt: true },
  },
  analyses: {
    orderBy: { createdAt: "desc" as const },
    take: 1,
    select: { id: true, status: true, provider: true, model: true, createdAt: true },
  },
} as const;

export async function createRequirement(userId: string, projectId: string, input: CreateRequirementInput) {
  const access = await getProjectAccess(userId, projectId);
  assertRole(access.role, WRITE_ROLES, "Viewer members cannot create requirements");
  if (access.status === ProjectStatus.ARCHIVED) throw new ApiError(409, "Archived projects cannot be changed");

  return prisma.$transaction(async (tx) => {
    const requirement = await tx.requirement.create({
      data: {
        projectId,
        createdById: userId,
        title: input.title,
        currentContent: input.content,
        status: input.status,
      },
    });
    await tx.requirementVersion.create({
      data: { requirementId: requirement.id, createdById: userId, versionNumber: 1, content: input.content },
    });
    return tx.requirement.findUniqueOrThrow({ where: { id: requirement.id }, select });
  });
}

export async function listRequirements(userId: string, projectId: string, status?: string) {
  await getProjectAccess(userId, projectId);
  return prisma.requirement.findMany({
    where: { projectId, ...(status ? { status: status as never } : {}) },
    select,
    orderBy: { updatedAt: "desc" },
  });
}

export async function getRequirement(userId: string, requirementId: string) {
  const requirement = await prisma.requirement.findFirst({
    where: { id: requirementId, project: { workspace: { memberships: { some: { userId } } } } },
    select,
  });
  if (!requirement) throw new ApiError(404, "Requirement was not found");
  return requirement;
}

export async function updateRequirement(userId: string, requirementId: string, input: UpdateRequirementInput) {
  const current = await prisma.requirement.findFirst({
    where: { id: requirementId, project: { workspace: { memberships: { some: { userId } } } } },
    select: { id: true, projectId: true, currentContent: true, versions: { orderBy: { versionNumber: "desc" }, take: 1, select: { versionNumber: true } } },
  });
  if (!current) throw new ApiError(404, "Requirement was not found");
  const access = await getProjectAccess(userId, current.projectId);
  assertRole(access.role, WRITE_ROLES, "Viewer members cannot update requirements");

  return prisma.$transaction(async (tx) => {
    await tx.requirement.update({
      where: { id: requirementId },
      data: {
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.content !== undefined ? { currentContent: input.content } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
      },
    });
    if (input.content !== undefined && input.content !== current.currentContent) {
      await tx.requirementVersion.create({
        data: {
          requirementId,
          createdById: userId,
          versionNumber: (current.versions[0]?.versionNumber ?? 0) + 1,
          content: input.content,
        },
      });
    }
    return tx.requirement.findUniqueOrThrow({ where: { id: requirementId }, select });
  });
}

export async function deleteRequirement(userId: string, requirementId: string): Promise<void> {
  const current = await prisma.requirement.findFirst({
    where: { id: requirementId, project: { workspace: { memberships: { some: { userId } } } } },
    select: { projectId: true, _count: { select: { tasks: true } } },
  });
  if (!current) throw new ApiError(404, "Requirement was not found");
  const access = await getProjectAccess(userId, current.projectId);
  assertRole(access.role, WRITE_ROLES, "Viewer members cannot delete requirements");
  if (current._count.tasks > 0) throw new ApiError(409, "Delete generated tasks before deleting this requirement");
  await prisma.requirement.delete({ where: { id: requirementId } });
}
