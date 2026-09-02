-- CreateTable
CREATE TABLE "Checkpoint" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "fileCount" INTEGER NOT NULL DEFAULT 0,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Checkpoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FileChange" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "fromPath" TEXT,
    "agentRun" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FileChange_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectProcess" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "command" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'RUNNING',
    "exitCode" INTEGER,
    "port" INTEGER,
    "pid" INTEGER,
    "startedBy" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "ProjectProcess_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectEnvVar" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "valueEnc" TEXT,
    "valuePlain" TEXT,
    "isSecret" BOOLEAN NOT NULL DEFAULT false,
    "target" TEXT NOT NULL DEFAULT 'all',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectEnvVar_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeploymentHistory" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "subdomain" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'BUILDING',
    "commitLabel" TEXT,
    "buildLog" TEXT,
    "healthOk" BOOLEAN,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deploymentId" TEXT,

    CONSTRAINT "DeploymentHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TerminalLog" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "processId" TEXT,
    "command" TEXT NOT NULL,
    "output" TEXT NOT NULL,
    "exitCode" INTEGER,
    "kind" TEXT NOT NULL DEFAULT 'exec',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TerminalLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContactMessage" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "handled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContactMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Checkpoint_projectId_createdAt_idx" ON "Checkpoint"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "FileChange_projectId_createdAt_idx" ON "FileChange"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "FileChange_projectId_agentRun_idx" ON "FileChange"("projectId", "agentRun");

-- CreateIndex
CREATE INDEX "ProjectProcess_projectId_status_idx" ON "ProjectProcess"("projectId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectEnvVar_projectId_key_key" ON "ProjectEnvVar"("projectId", "key");

-- CreateIndex
CREATE INDEX "DeploymentHistory_projectId_createdAt_idx" ON "DeploymentHistory"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "TerminalLog_projectId_createdAt_idx" ON "TerminalLog"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "ContactMessage_createdAt_idx" ON "ContactMessage"("createdAt");

-- AddForeignKey
ALTER TABLE "Checkpoint" ADD CONSTRAINT "Checkpoint_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FileChange" ADD CONSTRAINT "FileChange_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectProcess" ADD CONSTRAINT "ProjectProcess_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectEnvVar" ADD CONSTRAINT "ProjectEnvVar_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeploymentHistory" ADD CONSTRAINT "DeploymentHistory_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeploymentHistory" ADD CONSTRAINT "DeploymentHistory_deploymentId_fkey" FOREIGN KEY ("deploymentId") REFERENCES "Deployment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TerminalLog" ADD CONSTRAINT "TerminalLog_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
