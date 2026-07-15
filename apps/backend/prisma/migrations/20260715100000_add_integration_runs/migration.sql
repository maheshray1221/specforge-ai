CREATE TABLE "ProjectIntegrationRun" (
    "id" TEXT NOT NULL,
    "integrationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "status" "IntegrationStatus" NOT NULL,
    "requestSummary" JSONB NOT NULL DEFAULT '{}',
    "responseCode" INTEGER,
    "responseBody" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectIntegrationRun_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ProjectIntegrationRun_integrationId_createdAt_idx" ON "ProjectIntegrationRun"("integrationId", "createdAt");
CREATE INDEX "ProjectIntegrationRun_projectId_createdAt_idx" ON "ProjectIntegrationRun"("projectId", "createdAt");

ALTER TABLE "ProjectIntegrationRun" ADD CONSTRAINT "ProjectIntegrationRun_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "ProjectIntegration"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectIntegrationRun" ADD CONSTRAINT "ProjectIntegrationRun_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectIntegrationRun" ADD CONSTRAINT "ProjectIntegrationRun_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
