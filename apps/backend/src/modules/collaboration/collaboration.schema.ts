import { z } from "zod";

export const listTaskCommentsSchema = z.object({
  params: z.object({ taskId: z.string().uuid() }),
});

export const createTaskCommentSchema = z.object({
  params: z.object({ taskId: z.string().uuid() }),
  body: z.object({
    body: z.string().trim().min(1).max(4000),
  }),
});

export const listProjectActivitySchema = z.object({
  params: z.object({ projectId: z.string().uuid() }),
  query: z.object({
    limit: z.coerce.number().int().min(1).max(100).default(50),
  }),
});

export const listProjectMembersSchema = z.object({
  params: z.object({ projectId: z.string().uuid() }),
});

export type CreateTaskCommentInput = z.infer<typeof createTaskCommentSchema>["body"];
