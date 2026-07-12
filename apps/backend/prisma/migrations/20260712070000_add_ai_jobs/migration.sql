CREATE TYPE "AIJobType" AS ENUM (
  'REQUIREMENT_ANALYSIS',
  'TASK_GENERATION'
);

CREATE TYPE "AIJobStatus" AS ENUM (
  'QUEUED',
  'RUNNING',
  'RETRYING',
  'COMPLETED',
  'FAILED',
  'CANCELLED'
);

CREATE TABLE "AIJob" (
  "id" TEXT NOT NULL,
  "type" "AIJobType" NOT NULL,
  "status" "AIJobStatus" NOT NULL DEFAULT 'QUEUED',
  "userId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "requirementId" TEXT,
  "analysisId" TEXT,
  "idempotencyKey" TEXT NOT NULL,
  "provider" TEXT,
  "model" TEXT,
  "promptSchemaVersion" TEXT,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "maxAttempts" INTEGER NOT NULL DEFAULT 3,
  "durationMs" INTEGER,
  "promptTokens" INTEGER,
  "completionTokens" INTEGER,
  "totalTokens" INTEGER,
  "errorCategory" "AIErrorCategory",
  "errorMessage" TEXT,
  "outputRef" TEXT,
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "AIJob_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AIJob_type_idempotencyKey_key" ON "AIJob"("type", "idempotencyKey");
CREATE INDEX "AIJob_projectId_status_createdAt_idx" ON "AIJob"("projectId", "status", "createdAt");
CREATE INDEX "AIJob_requirementId_type_createdAt_idx" ON "AIJob"("requirementId", "type", "createdAt");
CREATE INDEX "AIJob_analysisId_type_createdAt_idx" ON "AIJob"("analysisId", "type", "createdAt");

ALTER TABLE "AIJob" ADD CONSTRAINT "AIJob_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AIJob" ADD CONSTRAINT "AIJob_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AIJob" ADD CONSTRAINT "AIJob_requirementId_fkey" FOREIGN KEY ("requirementId") REFERENCES "Requirement"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AIJob" ADD CONSTRAINT "AIJob_analysisId_fkey" FOREIGN KEY ("analysisId") REFERENCES "AIAnalysis"("id") ON DELETE SET NULL ON UPDATE CASCADE;
