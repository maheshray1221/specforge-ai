import { IntegrationProvider, IntegrationStatus } from "@prisma/client";
import { z } from "zod";

const blockedConfigKeyPattern = /(token|secret|password|apikey|api_key)/i;
const integrationConfigSchema = z
  .record(z.string(), z.unknown())
  .refine(
    (value) => Object.keys(value).every((key) => !blockedConfigKeyPattern.test(key)),
    "Store credentials in a secure secret store, not integration config",
  )
  .default({});

export const listProjectIntegrationsSchema = z.object({
  params: z.object({ projectId: z.string().uuid() }),
  query: z.object({
    provider: z.nativeEnum(IntegrationProvider).optional(),
    status: z.nativeEnum(IntegrationStatus).optional(),
  }),
});

export const createProjectIntegrationSchema = z.object({
  params: z.object({ projectId: z.string().uuid() }),
  body: z.object({
    provider: z.nativeEnum(IntegrationProvider),
    displayName: z.string().trim().min(2).max(120),
    externalRef: z.string().trim().max(300).optional(),
    config: integrationConfigSchema,
  }),
});

export const updateProjectIntegrationSchema = z.object({
  params: z.object({ integrationId: z.string().uuid() }),
  body: z.object({
    status: z.nativeEnum(IntegrationStatus).optional(),
    displayName: z.string().trim().min(2).max(120).optional(),
    externalRef: z.string().trim().max(300).nullable().optional(),
    config: integrationConfigSchema.optional(),
    lastError: z.string().trim().max(1000).nullable().optional(),
  }).refine((value) => Object.keys(value).length > 0, "At least one field is required"),
});

export const integrationIdSchema = z.object({
  params: z.object({ integrationId: z.string().uuid() }),
});

export const executeProjectIntegrationSchema = z.object({
  params: z.object({ integrationId: z.string().uuid() }),
  body: z.object({
    action: z.enum(["SEND_TEST", "EXPORT_TASKS"]).default("SEND_TEST"),
    taskIds: z.array(z.string().uuid()).max(100).default([]),
    dryRun: z.boolean().default(false),
  }).default({ action: "SEND_TEST", taskIds: [], dryRun: false }),
});

export const listProjectIntegrationRunsSchema = z.object({
  params: z.object({ integrationId: z.string().uuid() }),
});

export type CreateProjectIntegrationInput = z.infer<typeof createProjectIntegrationSchema>["body"];
export type UpdateProjectIntegrationInput = z.infer<typeof updateProjectIntegrationSchema>["body"];
export type ExecuteProjectIntegrationInput = z.infer<typeof executeProjectIntegrationSchema>["body"];
