CREATE TABLE "ProjectIntegrationSecret" (
    "id" TEXT NOT NULL,
    "integrationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "encryptedValue" TEXT NOT NULL,
    "iv" TEXT NOT NULL,
    "authTag" TEXT NOT NULL,
    "keyFingerprint" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectIntegrationSecret_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProjectIntegrationSecret_integrationId_name_key" ON "ProjectIntegrationSecret"("integrationId", "name");
CREATE INDEX "ProjectIntegrationSecret_integrationId_idx" ON "ProjectIntegrationSecret"("integrationId");

ALTER TABLE "ProjectIntegrationSecret" ADD CONSTRAINT "ProjectIntegrationSecret_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "ProjectIntegration"("id") ON DELETE CASCADE ON UPDATE CASCADE;
