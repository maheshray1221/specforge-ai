import { z } from "zod";

export const analyzeRequirementSchema = z.object({
  params: z.object({ requirementId: z.string().uuid() }),
  body: z.object({ force: z.boolean().default(false) }).default({ force: false }),
});

export const requirementAnalysisListSchema = z.object({ params: z.object({ requirementId: z.string().uuid() }) });
export const analysisIdSchema = z.object({ params: z.object({ analysisId: z.string().uuid() }) });
