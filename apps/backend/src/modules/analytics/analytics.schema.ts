import { AnalyticsEventType } from "@prisma/client";
import { z } from "zod";

const analyticsMetadataSchema = z.record(z.string(), z.unknown()).default({});

export const trackAnalyticsEventSchema = z.object({
  body: z.object({
    type: z.nativeEnum(AnalyticsEventType),
    projectId: z.string().uuid().optional(),
    entityType: z.string().trim().max(80).optional(),
    entityId: z.string().trim().max(120).optional(),
    metadata: analyticsMetadataSchema,
  }),
});

export const projectAnalyticsSummarySchema = z.object({
  params: z.object({ projectId: z.string().uuid() }),
  query: z.object({
    days: z.coerce.number().int().min(1).max(365).default(30),
  }),
});

export const analysisFeedbackSchema = z.object({
  params: z.object({ analysisId: z.string().uuid() }),
  body: z.object({
    useful: z.boolean(),
    reason: z.string().trim().max(1000).optional(),
  }),
});

export type TrackAnalyticsEventInput = z.infer<typeof trackAnalyticsEventSchema>["body"];
export type AnalysisFeedbackInput = z.infer<typeof analysisFeedbackSchema>["body"];
