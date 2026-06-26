import { SprintStatus } from "@prisma/client";
import { z } from "zod";

const optionalDate = z.string().datetime().nullable().optional();

export const createSprintSchema = z.object({
  params: z.object({ projectId: z.string().uuid() }),
  body: z.object({
    name: z.string().trim().min(2).max(80),
    goal: z.string().trim().max(500).optional(),
    startDate: optionalDate,
    endDate: optionalDate,
    capacityPoints: z.number().int().min(1).max(500).nullable().optional(),
  }).refine((value) => !value.startDate || !value.endDate || new Date(value.startDate) <= new Date(value.endDate), "End date must be after start date"),
});

export const listSprintsSchema = z.object({ params: z.object({ projectId: z.string().uuid() }) });

export const updateSprintSchema = z.object({
  params: z.object({ sprintId: z.string().uuid() }),
  body: z.object({
    name: z.string().trim().min(2).max(80).optional(),
    goal: z.string().trim().max(500).nullable().optional(),
    status: z.nativeEnum(SprintStatus).optional(),
    startDate: optionalDate,
    endDate: optionalDate,
    capacityPoints: z.number().int().min(1).max(500).nullable().optional(),
  }).refine((value) => Object.keys(value).length > 0, "At least one field is required"),
});

export const sprintTaskSchema = z.object({ params: z.object({ sprintId: z.string().uuid(), taskId: z.string().uuid() }) });

export type CreateSprintInput = z.infer<typeof createSprintSchema>["body"];
export type UpdateSprintInput = z.infer<typeof updateSprintSchema>["body"];
