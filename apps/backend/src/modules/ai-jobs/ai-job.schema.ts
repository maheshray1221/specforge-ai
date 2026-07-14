import { AIJobStatus, AIJobType } from "@prisma/client";
import { z } from "zod";

export const aiJobIdSchema = z.object({
  params: z.object({ jobId: z.string().uuid() }),
});

export const listProjectAIJobsSchema = z.object({
  params: z.object({ projectId: z.string().uuid() }),
  query: z
    .object({
      status: z.nativeEnum(AIJobStatus).optional(),
      type: z.nativeEnum(AIJobType).optional(),
      limit: z.coerce.number().int().min(1).max(100).default(25),
    })
    .default({ limit: 25 }),
});
