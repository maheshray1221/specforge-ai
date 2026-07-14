CREATE TYPE "AnalyticsEventType" AS ENUM (
    'USER_REGISTERED',
    'PROJECT_CREATED',
    'REQUIREMENT_CREATED',
    'REQUIREMENT_ANALYZED',
    'REQUIREMENT_APPROVED',
    'TASKS_GENERATED',
    'SPRINT_CREATED',
    'ANALYSIS_FEEDBACK_SUBMITTED'
);

CREATE TABLE "AnalyticsEvent" (
    "id" TEXT NOT NULL,
    "type" "AnalyticsEventType" NOT NULL,
    "userId" TEXT,
    "projectId" TEXT,
    "entityType" TEXT,
    "entityId" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnalyticsEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AnalyticsEvent_projectId_type_createdAt_idx" ON "AnalyticsEvent"("projectId", "type", "createdAt");
CREATE INDEX "AnalyticsEvent_userId_type_createdAt_idx" ON "AnalyticsEvent"("userId", "type", "createdAt");
CREATE INDEX "AnalyticsEvent_type_createdAt_idx" ON "AnalyticsEvent"("type", "createdAt");

ALTER TABLE "AnalyticsEvent" ADD CONSTRAINT "AnalyticsEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AnalyticsEvent" ADD CONSTRAINT "AnalyticsEvent_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
