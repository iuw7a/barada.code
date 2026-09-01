-- CreateTable
CREATE TABLE "AppClick" (
    "id" TEXT NOT NULL,
    "store" TEXT NOT NULL,
    "referrer" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AppClick_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AppClick_store_idx" ON "AppClick"("store");

-- CreateIndex
CREATE INDEX "AppClick_createdAt_idx" ON "AppClick"("createdAt");
