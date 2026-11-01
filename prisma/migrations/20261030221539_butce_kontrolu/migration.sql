-- CreateTable
CREATE TABLE "BudgetBaseline" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "note" TEXT,
    "total" DECIMAL(18,2) NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BudgetBaseline_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BudgetBaselineLine" (
    "id" TEXT NOT NULL,
    "baselineId" TEXT NOT NULL,
    "costItemId" TEXT NOT NULL,
    "blockId" TEXT,
    "description" TEXT,
    "quantity" DECIMAL(18,4) NOT NULL,
    "unit" TEXT,
    "unitPriceTry" DECIMAL(18,4),
    "amount" DECIMAL(18,2) NOT NULL,

    CONSTRAINT "BudgetBaselineLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CostItemProgress" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "costItemId" TEXT NOT NULL,
    "percent" DECIMAL(5,2) NOT NULL,
    "note" TEXT,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CostItemProgress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BudgetBaseline_projectId_createdAt_idx" ON "BudgetBaseline"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "BudgetBaselineLine_baselineId_idx" ON "BudgetBaselineLine"("baselineId");

-- CreateIndex
CREATE UNIQUE INDEX "CostItemProgress_projectId_costItemId_key" ON "CostItemProgress"("projectId", "costItemId");

-- AddForeignKey
ALTER TABLE "BudgetBaseline" ADD CONSTRAINT "BudgetBaseline_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetBaselineLine" ADD CONSTRAINT "BudgetBaselineLine_baselineId_fkey" FOREIGN KEY ("baselineId") REFERENCES "BudgetBaseline"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetBaselineLine" ADD CONSTRAINT "BudgetBaselineLine_costItemId_fkey" FOREIGN KEY ("costItemId") REFERENCES "CostItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CostItemProgress" ADD CONSTRAINT "CostItemProgress_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CostItemProgress" ADD CONSTRAINT "CostItemProgress_costItemId_fkey" FOREIGN KEY ("costItemId") REFERENCES "CostItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
