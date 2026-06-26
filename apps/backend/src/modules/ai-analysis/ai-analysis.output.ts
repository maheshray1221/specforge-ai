import { z } from "zod";

const priority = z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]);

export const aiAnalysisOutputSchema = z.object({
  clarificationQuestions: z.array(z.object({
    question: z.string(),
    reason: z.string(),
    options: z.array(z.string()),
    required: z.boolean(),
  })),
  functionalRequirements: z.array(z.object({
    id: z.string(),
    title: z.string(),
    description: z.string(),
    priority,
  })),
  nonFunctionalRequirements: z.array(z.object({
    category: z.string(),
    description: z.string(),
    measurableTarget: z.string(),
  })),
  userStories: z.array(z.object({
    id: z.string(),
    role: z.string(),
    goal: z.string(),
    benefit: z.string(),
    acceptanceCriteria: z.array(z.string()),
    storyPoints: z.number().int().min(1).max(13),
  })),
  technicalPlan: z.object({
    summary: z.string(),
    frontend: z.array(z.string()),
    backend: z.array(z.string()),
    database: z.array(z.string()),
    integrations: z.array(z.string()),
    apiEndpoints: z.array(z.object({ method: z.string(), path: z.string(), purpose: z.string() })),
    entities: z.array(z.object({
      name: z.string(),
      fields: z.array(z.string()),
      relationships: z.array(z.string()),
    })),
  }),
  risks: z.array(z.object({ title: z.string(), impact: z.string(), mitigation: z.string() })),
});

export type AIAnalysisOutput = z.infer<typeof aiAnalysisOutputSchema>;

const stringSchema = { type: "string" } as const;
const stringArraySchema = { type: "array", items: stringSchema } as const;

export const aiAnalysisJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "clarificationQuestions",
    "functionalRequirements",
    "nonFunctionalRequirements",
    "userStories",
    "technicalPlan",
    "risks",
  ],
  properties: {
    clarificationQuestions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["question", "reason", "options", "required"],
        properties: {
          question: stringSchema,
          reason: stringSchema,
          options: stringArraySchema,
          required: { type: "boolean" },
        },
      },
    },
    functionalRequirements: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "title", "description", "priority"],
        properties: {
          id: stringSchema,
          title: stringSchema,
          description: stringSchema,
          priority: { type: "string", enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"] },
        },
      },
    },
    nonFunctionalRequirements: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["category", "description", "measurableTarget"],
        properties: {
          category: stringSchema,
          description: stringSchema,
          measurableTarget: stringSchema,
        },
      },
    },
    userStories: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "role", "goal", "benefit", "acceptanceCriteria", "storyPoints"],
        properties: {
          id: stringSchema,
          role: stringSchema,
          goal: stringSchema,
          benefit: stringSchema,
          acceptanceCriteria: stringArraySchema,
          storyPoints: { type: "integer", minimum: 1, maximum: 13 },
        },
      },
    },
    technicalPlan: {
      type: "object",
      additionalProperties: false,
      required: ["summary", "frontend", "backend", "database", "integrations", "apiEndpoints", "entities"],
      properties: {
        summary: stringSchema,
        frontend: stringArraySchema,
        backend: stringArraySchema,
        database: stringArraySchema,
        integrations: stringArraySchema,
        apiEndpoints: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["method", "path", "purpose"],
            properties: { method: stringSchema, path: stringSchema, purpose: stringSchema },
          },
        },
        entities: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["name", "fields", "relationships"],
            properties: {
              name: stringSchema,
              fields: stringArraySchema,
              relationships: stringArraySchema,
            },
          },
        },
      },
    },
    risks: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "impact", "mitigation"],
        properties: { title: stringSchema, impact: stringSchema, mitigation: stringSchema },
      },
    },
  },
} as const;
