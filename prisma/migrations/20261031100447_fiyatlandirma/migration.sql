-- CreateEnum
CREATE TYPE "ProfitMethod" AS ENUM ('MARGIN', 'MARKUP');

-- CreateEnum
CREATE TYPE "PricingCostBasis" AS ENUM ('BUDGET', 'EAC', 'MANUAL');

-- CreateEnum
CREATE TYPE "PricingFactorKind" AS ENUM ('USAGE', 'FLOOR', 'FACADE', 'VIEW', 'LAYOUT');

-- AlterTable
ALTER TABLE "Unit" ADD COLUMN     "listPrice" DECIMAL(18,2),
ADD COLUMN     "listVatRate" DECIMAL(5,2),
ADD COLUMN     "priceLocked" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "vatRateOverride" DECIMAL(5,2);

-- CreateTable
CREATE TABLE "PricingSetting" (
    "projectId" TEXT NOT NULL,
    "profitMethod" "ProfitMethod" NOT NULL DEFAULT 'MARGIN',
    "profitPercent" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "commissionPercent" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "advertisingBudget" DECIMAL(18,2),
    "costBasis" "PricingCostBasis" NOT NULL DEFAULT 'BUDGET',
    "manualCost" DECIMAL(18,2),
    "roundingStep" DECIMAL(14,2) NOT NULL DEFAULT 10000,
    "extraAreaFactor" DECIMAL(6,4) NOT NULL DEFAULT 0,
    "reducedVatEligible" BOOLEAN NOT NULL DEFAULT true,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PricingSetting_pkey" PRIMARY KEY ("projectId")
);

-- CreateTable
CREATE TABLE "PricingFactor" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "kind" "PricingFactorKind" NOT NULL,
    "key" TEXT NOT NULL,
    "value" DECIMAL(8,4) NOT NULL,

    CONSTRAINT "PricingFactor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceList" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "note" TEXT,
    "costBasis" "PricingCostBasis" NOT NULL,
    "cost" DECIMAL(18,2) NOT NULL,
    "advertising" DECIMAL(18,2) NOT NULL,
    "commissionPercent" DECIMAL(6,2) NOT NULL,
    "profitMethod" "ProfitMethod" NOT NULL,
    "profitPercent" DECIMAL(6,2) NOT NULL,
    "baseM2" DECIMAL(14,2) NOT NULL,
    "targetRevenue" DECIMAL(18,2) NOT NULL,
    "total" DECIMAL(18,2) NOT NULL,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PriceList_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceListLine" (
    "id" TEXT NOT NULL,
    "priceListId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "price" DECIMAL(18,2) NOT NULL,
    "vatRate" DECIMAL(5,2),
    "locked" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "PriceListLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PricingFactor_projectId_kind_key_key" ON "PricingFactor"("projectId", "kind", "key");

-- CreateIndex
CREATE INDEX "PriceList_projectId_approvedAt_idx" ON "PriceList"("projectId", "approvedAt");

-- CreateIndex
CREATE UNIQUE INDEX "PriceListLine_priceListId_unitId_key" ON "PriceListLine"("priceListId", "unitId");

-- AddForeignKey
ALTER TABLE "PricingSetting" ADD CONSTRAINT "PricingSetting_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PricingSetting" ADD CONSTRAINT "PricingSetting_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PricingFactor" ADD CONSTRAINT "PricingFactor_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceList" ADD CONSTRAINT "PriceList_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceList" ADD CONSTRAINT "PriceList_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceListLine" ADD CONSTRAINT "PriceListLine_priceListId_fkey" FOREIGN KEY ("priceListId") REFERENCES "PriceList"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceListLine" ADD CONSTRAINT "PriceListLine_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
