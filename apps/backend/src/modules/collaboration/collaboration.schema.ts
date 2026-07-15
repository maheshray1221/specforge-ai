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

export const updateProjectMemberSchema = z.object({
  params: z.object({
    projectId: z.string().uuid(),
    memberId: z.string().uuid(),
  }),
  body: z.object({
    role: z.enum(["ADMIN", "MEMBER", "VIEWER"]),
  }),
});

export const removeProjectMemberSchema = z.object({
  params: z.object({
    projectId: z.string().uuid(),
    memberId: z.string().uuid(),
  }),
});

export const listProjectInvitationsSchema = z.object({
  params: z.object({ projectId: z.string().uuid() }),
});

export const createProjectInvitationSchema = z.object({
  params: z.object({ projectId: z.string().uuid() }),
  body: z.object({
    email: z.email().trim().toLowerCase(),
    role: z.enum(["ADMIN", "MEMBER", "VIEWER"]).default("MEMBER"),
    expiresInDays: z.coerce.number().int().min(1).max(30).default(14),
  }),
});

export const cancelProjectInvitationSchema = z.object({
  params: z.object({ invitationId: z.string().uuid() }),
});

export const acceptProjectInvitationSchema = z.object({
  body: z.object({
    token: z.string().trim().min(32).max(256),
  }),
});

export type CreateTaskCommentInput = z.infer<typeof createTaskCommentSchema>["body"];
export type UpdateProjectMemberInput = z.infer<typeof updateProjectMemberSchema>["body"];
export type CreateProjectInvitationInput = z.infer<typeof createProjectInvitationSchema>["body"];
export type AcceptProjectInvitationInput = z.infer<typeof acceptProjectInvitationSchema>["body"];
