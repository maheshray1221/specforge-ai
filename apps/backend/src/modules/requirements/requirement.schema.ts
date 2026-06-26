import { RequirementStatus } from "@prisma/client";
import { z } from "zod";

export const createRequirementSchema = z.object({
  params: z.object({ projectId: z.string().uuid() }),
  body: z.object({
    title: z.string().trim().min(3).max(140),
    content: z.string().trim().min(20).max(60000),
    status: z.nativeEnum(RequirementStatus).default(RequirementStatus.READY),
  }),
});

export const listRequirementsSchema = z.object({
  params: z.object({ projectId: z.string().uuid() }),
  query: z.object({ status: z.nativeEnum(RequirementStatus).optional() }),
});

export const requirementIdSchema = z.object({ params: z.object({ requirementId: z.string().uuid() }) });

export const updateRequirementSchema = z.object({
  params: z.object({ requirementId: z.string().uuid() }),
  body: z.object({
    title: z.string().trim().min(3).max(140).optional(),
    content: z.string().trim().min(20).max(60000).optional(),
    status: z.nativeEnum(RequirementStatus).optional(),
  }).refine((value) => Object.keys(value).length > 0, "At least one field is required"),
});

export type CreateRequirementInput = z.infer<typeof createRequirementSchema>["body"];
export type UpdateRequirementInput = z.infer<typeof updateRequirementSchema>["body"];
