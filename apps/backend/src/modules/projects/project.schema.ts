import { ProjectStatus } from "@prisma/client";
import { z } from "zod";

export const createProjectSchema = z.object({
  body: z.object({
    workspaceId: z.string().uuid(),
    name: z.string().trim().min(2).max(100),
    key: z.string().trim().min(2).max(12).regex(/^[A-Za-z0-9_-]+$/).transform((value) => value.toUpperCase()),
    description: z.string().trim().max(1000).optional(),
  }),
});

export const projectIdSchema = z.object({ params: z.object({ projectId: z.string().uuid() }) });

export const updateProjectSchema = z.object({
  params: z.object({ projectId: z.string().uuid() }),
  body: z.object({
    name: z.string().trim().min(2).max(100).optional(),
    description: z.string().trim().max(1000).nullable().optional(),
    status: z.nativeEnum(ProjectStatus).optional(),
  }).refine((value) => Object.keys(value).length > 0, "At least one field is required"),
});

export const listProjectsSchema = z.object({
  query: z.object({
    workspaceId: z.string().uuid(),
    search: z.string().trim().max(100).optional(),
    status: z.nativeEnum(ProjectStatus).optional(),
  }),
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>["body"];
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>["body"];
export type ListProjectsQuery = z.infer<typeof listProjectsSchema>["query"];
