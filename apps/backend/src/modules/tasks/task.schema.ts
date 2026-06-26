import { TaskPriority, TaskStatus, TaskType } from "@prisma/client";
import { z } from "zod";

export const generateTasksSchema = z.object({
  params: z.object({ analysisId: z.string().uuid() }),
  body: z.object({ regenerate: z.boolean().default(false) }).default({ regenerate: false }),
});

export const listTasksSchema = z.object({
  params: z.object({ projectId: z.string().uuid() }),
  query: z.object({ status: z.nativeEnum(TaskStatus).optional(), type: z.nativeEnum(TaskType).optional(), sprintId: z.string().uuid().optional() }),
});

export const taskIdSchema = z.object({ params: z.object({ taskId: z.string().uuid() }) });

export const updateTaskSchema = z.object({
  params: z.object({ taskId: z.string().uuid() }),
  body: z.object({
    title: z.string().trim().min(3).max(180).optional(),
    description: z.string().trim().min(10).optional(),
    type: z.nativeEnum(TaskType).optional(),
    priority: z.nativeEnum(TaskPriority).optional(),
    status: z.nativeEnum(TaskStatus).optional(),
    storyPoints: z.number().int().min(1).max(13).nullable().optional(),
    labels: z.array(z.string().trim().min(1).max(30)).max(20).optional(),
    sprintId: z.string().uuid().nullable().optional(),
  }).refine((value) => Object.keys(value).length > 0, "At least one field is required"),
});

export type UpdateTaskInput = z.infer<typeof updateTaskSchema>["body"];
