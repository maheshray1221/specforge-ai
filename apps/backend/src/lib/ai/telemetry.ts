import { AIErrorCategory } from "@prisma/client";
import { ApiError } from "../../utils/api-error.js";

const categories = new Set<string>(Object.values(AIErrorCategory));

function readNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.round(value))
    : undefined;
}

function readCategory(value: unknown): AIErrorCategory {
  return typeof value === "string" && categories.has(value)
    ? value as AIErrorCategory
    : AIErrorCategory.UNKNOWN;
}

export function extractAIErrorTelemetry(error: unknown) {
  const details =
    error instanceof ApiError &&
    typeof error.details === "object" &&
    error.details !== null
      ? error.details as Record<string, unknown>
      : {};

  return {
    errorCategory: readCategory(details.aiErrorCategory),
    attempts: readNumber(details.attempts) ?? 0,
    durationMs: readNumber(details.durationMs),
    message: error instanceof Error ? error.message : "AI generation failed",
  };
}
