CREATE TYPE "AIErrorCategory" AS ENUM (
  'CONFIGURATION',
  'INPUT_TOO_LARGE',
  'RATE_LIMIT',
  'PROVIDER_UNAVAILABLE',
  'PROVIDER_BAD_RESPONSE',
  'TIMEOUT',
  'VALIDATION',
  'UNKNOWN'
);

ALTER TABLE "AIAnalysis"
  ADD COLUMN "errorCategory" "AIErrorCategory",
  ADD COLUMN "promptSchemaVersion" TEXT NOT NULL DEFAULT 'v1',
  ADD COLUMN "attempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "durationMs" INTEGER,
  ADD COLUMN "promptTokens" INTEGER,
  ADD COLUMN "completionTokens" INTEGER,
  ADD COLUMN "totalTokens" INTEGER,
  ADD COLUMN "taskGenerationAttempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "taskGenerationDurationMs" INTEGER,
  ADD COLUMN "taskGenerationPromptTokens" INTEGER,
  ADD COLUMN "taskGenerationCompletionTokens" INTEGER,
  ADD COLUMN "taskGenerationTotalTokens" INTEGER,
  ADD COLUMN "taskGenerationErrorCategory" "AIErrorCategory",
  ADD COLUMN "taskGenerationErrorMessage" TEXT;
