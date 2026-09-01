-- CreateTable
CREATE TABLE "Deployment" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "subdomain" TEXT NOT NULL,
    "customDomain" TEXT,
    "domainVerifiedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'LIVE',
    "lastDeployedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Deployment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Deployment_projectId_key" ON "Deployment"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "Deployment_subdomain_key" ON "Deployment"("subdomain");

-- CreateIndex
CREATE UNIQUE INDEX "Deployment_customDomain_key" ON "Deployment"("customDomain");

-- CreateIndex
CREATE INDEX "Deployment_subdomain_idx" ON "Deployment"("subdomain");

-- AddForeignKey
ALTER TABLE "Deployment" ADD CONSTRAINT "Deployment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
