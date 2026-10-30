-- CreateEnum
CREATE TYPE "UsageType" AS ENUM ('RESIDENTIAL', 'SHOP', 'OFFICE', 'STORAGE');

-- CreateEnum
CREATE TYPE "UnitOwner" AS ENUM ('CONTRACTOR', 'LANDOWNER');

-- CreateEnum
CREATE TYPE "ResourceType" AS ENUM ('MATERIAL', 'LABOR', 'EQUIPMENT', 'SERVICE');

-- CreateEnum
CREATE TYPE "PriceSource" AS ENUM ('QUOTE', 'MARKET');

-- CreateEnum
CREATE TYPE "QuantitySource" AS ENUM ('PARAMETRIC', 'FORMULA', 'MANUAL');

-- CreateEnum
CREATE TYPE "BudgetPriceSource" AS ENUM ('RECIPE', 'RESOURCE', 'MANUAL');

-- CreateEnum
CREATE TYPE "CoefficientBasis" AS ENUM ('CONSTRUCTION_AREA', 'SELLABLE_GROSS', 'SELLABLE_NET', 'LAND_AREA', 'UNIT_COUNT');

-- AlterEnum
ALTER TYPE "SupplyMethod" ADD VALUE 'OWN_TEAM';

-- AlterTable
ALTER TABLE "ConnectionItem" ADD COLUMN     "resourceId" TEXT;

-- AlterTable
ALTER TABLE "Expense" ADD COLUMN     "resourceId" TEXT;

-- CreateTable
CREATE TABLE "Landowner" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sharePercent" DECIMAL(7,4) NOT NULL,
    "monthlyRentAid" DECIMAL(18,2),
    "phone" TEXT,
    "email" TEXT,
    "notes" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Landowner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Unit" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "blockId" TEXT NOT NULL,
    "floor" INTEGER NOT NULL,
    "doorNo" TEXT NOT NULL,
    "usageType" "UsageType" NOT NULL DEFAULT 'RESIDENTIAL',
    "layout" TEXT,
    "netArea" DECIMAL(10,2) NOT NULL,
    "grossArea" DECIMAL(10,2) NOT NULL,
    "commonAreaShare" DECIMAL(10,2),
    "facade" TEXT,
    "view" TEXT,
    "extraArea" DECIMAL(10,2),
    "owner" "UnitOwner" NOT NULL DEFAULT 'CONTRACTOR',
    "landownerId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Unit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Resource" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "ResourceType" NOT NULL DEFAULT 'MATERIAL',
    "category" TEXT,
    "unit" TEXT NOT NULL,
    "wastePercent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "currency" "Currency" NOT NULL DEFAULT 'TRY',
    "spec" TEXT,
    "defaultSupplierId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Resource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResourcePrice" (
    "id" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "price" DECIMAL(18,4) NOT NULL,
    "currency" "Currency" NOT NULL DEFAULT 'TRY',
    "source" "PriceSource" NOT NULL,
    "supplierId" TEXT,
    "note" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResourcePrice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Recipe" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Recipe_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecipeLine" (
    "id" TEXT NOT NULL,
    "recipeId" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "quantity" DECIMAL(18,6) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "RecipeLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParametricCoefficient" (
    "id" TEXT NOT NULL,
    "projectId" TEXT,
    "costItemCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "basis" "CoefficientBasis" NOT NULL DEFAULT 'CONSTRUCTION_AREA',
    "coefficient" DECIMAL(18,6) NOT NULL,
    "unit" TEXT NOT NULL,
    "note" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ParametricCoefficient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BudgetLine" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "costItemId" TEXT NOT NULL,
    "blockId" TEXT,
    "description" TEXT,
    "supplyMethod" "SupplyMethod",
    "quantity" DECIMAL(18,4) NOT NULL,
    "quantitySource" "QuantitySource" NOT NULL DEFAULT 'MANUAL',
    "formula" TEXT,
    "coefficientId" TEXT,
    "unit" TEXT,
    "priceSource" "BudgetPriceSource" NOT NULL DEFAULT 'MANUAL',
    "recipeId" TEXT,
    "resourceId" TEXT,
    "unitPrice" DECIMAL(18,4),
    "currency" "Currency" NOT NULL DEFAULT 'TRY',
    "wastePercent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "priceNote" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BudgetLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Landowner_projectId_idx" ON "Landowner"("projectId");

-- CreateIndex
CREATE INDEX "Unit_projectId_idx" ON "Unit"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "Unit_blockId_doorNo_key" ON "Unit"("blockId", "doorNo");

-- CreateIndex
CREATE UNIQUE INDEX "Resource_code_key" ON "Resource"("code");

-- CreateIndex
CREATE INDEX "Resource_name_idx" ON "Resource"("name");

-- CreateIndex
CREATE INDEX "ResourcePrice_resourceId_date_idx" ON "ResourcePrice"("resourceId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "Recipe_code_key" ON "Recipe"("code");

-- CreateIndex
CREATE INDEX "RecipeLine_recipeId_idx" ON "RecipeLine"("recipeId");

-- CreateIndex
CREATE INDEX "ParametricCoefficient_projectId_idx" ON "ParametricCoefficient"("projectId");

-- CreateIndex
CREATE INDEX "BudgetLine_projectId_costItemId_idx" ON "BudgetLine"("projectId", "costItemId");

-- CreateIndex
CREATE INDEX "Expense_resourceId_idx" ON "Expense"("resourceId");

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "Resource"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConnectionItem" ADD CONSTRAINT "ConnectionItem_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "Resource"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Landowner" ADD CONSTRAINT "Landowner_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Unit" ADD CONSTRAINT "Unit_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Unit" ADD CONSTRAINT "Unit_blockId_fkey" FOREIGN KEY ("blockId") REFERENCES "Block"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Unit" ADD CONSTRAINT "Unit_landownerId_fkey" FOREIGN KEY ("landownerId") REFERENCES "Landowner"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Resource" ADD CONSTRAINT "Resource_defaultSupplierId_fkey" FOREIGN KEY ("defaultSupplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResourcePrice" ADD CONSTRAINT "ResourcePrice_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "Resource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResourcePrice" ADD CONSTRAINT "ResourcePrice_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeLine" ADD CONSTRAINT "RecipeLine_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeLine" ADD CONSTRAINT "RecipeLine_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "Resource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParametricCoefficient" ADD CONSTRAINT "ParametricCoefficient_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetLine" ADD CONSTRAINT "BudgetLine_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetLine" ADD CONSTRAINT "BudgetLine_costItemId_fkey" FOREIGN KEY ("costItemId") REFERENCES "CostItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetLine" ADD CONSTRAINT "BudgetLine_blockId_fkey" FOREIGN KEY ("blockId") REFERENCES "Block"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetLine" ADD CONSTRAINT "BudgetLine_coefficientId_fkey" FOREIGN KEY ("coefficientId") REFERENCES "ParametricCoefficient"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetLine" ADD CONSTRAINT "BudgetLine_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetLine" ADD CONSTRAINT "BudgetLine_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "Resource"("id") ON DELETE SET NULL ON UPDATE CASCADE;
