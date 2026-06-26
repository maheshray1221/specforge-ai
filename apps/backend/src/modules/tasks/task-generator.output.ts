import { TaskPriority, TaskType } from "@prisma/client";
import { z } from "zod";

export const taskGeneratorOutputSchema = z.object({
  tasks: z.array(z.object({
    title: z.string().min(3).max(180),
    description: z.string().min(10),
    type: z.nativeEnum(TaskType),
    priority: z.nativeEnum(TaskPriority),
    storyPoints: z.number().int().min(1).max(13),
    acceptanceCriteria: z.array(z.string()),
    labels: z.array(z.string()),
    dependencies: z.array(z.string()),
    sourceUserStoryIds: z.array(z.string()),
  })).min(1).max(80),
  generationNotes: z.array(z.string()),
});

const str = { type: "string" } as const;
export const taskGeneratorJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["tasks", "generationNotes"],
  properties: {
    tasks: {
      type: "array",
      minItems: 1,
      maxItems: 80,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "description", "type", "priority", "storyPoints", "acceptanceCriteria", "labels", "dependencies", "sourceUserStoryIds"],
        properties: {
          title: str,
          description: str,
          type: { type: "string", enum: ["FRONTEND", "BACKEND", "QA", "DEVOPS", "DESIGN", "DOCUMENTATION"] },
          priority: { type: "string", enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"] },
          storyPoints: { type: "integer", minimum: 1, maximum: 13 },
          acceptanceCriteria: { type: "array", items: str },
          labels: { type: "array", items: str },
          dependencies: { type: "array", items: str },
          sourceUserStoryIds: { type: "array", items: str },
        },
      },
    },
    generationNotes: { type: "array", items: str },
  },
} as const;
