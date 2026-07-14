CREATE TYPE "IntegrationProvider" AS ENUM ('GITHUB', 'JIRA', 'LINEAR', 'SLACK', 'WEBHOOK');

CREATE TYPE "IntegrationStatus" AS ENUM ('CONNECTED', 'PAUSED', 'ERROR');

CREATE TABLE "ProjectIntegration" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "provider" "IntegrationProvider" NOT NULL,
    "status" "IntegrationStatus" NOT NULL DEFAULT 'CONNECTED',
    "displayName" TEXT NOT NULL,
    "externalRef" TEXT,
    "config" JSONB NOT NULL DEFAULT '{}',
    "lastSyncedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectIntegration_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProjectIntegration_projectId_provider_displayName_key" ON "ProjectIntegration"("projectId", "provider", "displayName");
CREATE INDEX "ProjectIntegration_projectId_provider_status_idx" ON "ProjectIntegration"("projectId", "provider", "status");

ALTER TABLE "ProjectIntegration" ADD CONSTRAINT "ProjectIntegration_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
