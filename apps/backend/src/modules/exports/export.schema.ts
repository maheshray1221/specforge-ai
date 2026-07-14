import { TaskPriority, TaskStatus, TaskType } from "@prisma/client";
import { z } from "zod";

export const exportProjectTasksSchema = z.object({
  params: z.object({ projectId: z.string().uuid() }),
  query: z.object({
    status: z.nativeEnum(TaskStatus).optional(),
    type: z.nativeEnum(TaskType).optional(),
    priority: z.nativeEnum(TaskPriority).optional(),
    sprintId: z.string().uuid().optional(),
    search: z.string().trim().max(100).optional(),
  }),
});
