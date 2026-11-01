-- CreateEnum
CREATE TYPE "MachineStatus" AS ENUM ('ACTIVE', 'SOLD', 'SCRAPPED');

-- CreateEnum
CREATE TYPE "MachineUsageUnit" AS ENUM ('HOUR', 'DAY');

-- CreateEnum
CREATE TYPE "MachineEntryType" AS ENUM ('PURCHASE', 'FINANCING', 'FUEL', 'MAINTENANCE', 'REPAIR', 'INSURANCE', 'TAX', 'OPERATOR', 'TRANSPORT', 'OTHER_COST', 'RENT_INCOME', 'SALE', 'OTHER_INCOME');

-- AlterEnum
ALTER TYPE "ExpenseKind" ADD VALUE 'MACHINE';

-- AlterTable
ALTER TABLE "Expense" ADD COLUMN     "machineUsageId" TEXT;

-- CreateTable
CREATE TABLE "Machine" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "brand" TEXT,
    "model" TEXT,
    "plateOrSerial" TEXT,
    "year" INTEGER,
    "status" "MachineStatus" NOT NULL DEFAULT 'ACTIVE',
    "usageUnit" "MachineUsageUnit" NOT NULL DEFAULT 'HOUR',
    "internalRate" DECIMAL(18,2),
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Machine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MachineEntry" (
    "id" TEXT NOT NULL,
    "machineId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "type" "MachineEntryType" NOT NULL,
    "description" TEXT,
    "amount" DECIMAL(18,2) NOT NULL,
    "quantity" DECIMAL(18,4),
    "unit" TEXT,
    "paid" BOOLEAN NOT NULL DEFAULT true,
    "dueDate" DATE,
    "projectId" TEXT,
    "counterparty" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "MachineEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MachineUsage" (
    "id" TEXT NOT NULL,
    "machineId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "quantity" DECIMAL(18,2) NOT NULL,
    "rate" DECIMAL(18,2) NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "costItemId" TEXT NOT NULL,
    "description" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "MachineUsage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Machine_code_key" ON "Machine"("code");

-- CreateIndex
CREATE INDEX "MachineEntry_machineId_date_idx" ON "MachineEntry"("machineId", "date");

-- CreateIndex
CREATE INDEX "MachineUsage_machineId_date_idx" ON "MachineUsage"("machineId", "date");

-- CreateIndex
CREATE INDEX "MachineUsage_projectId_idx" ON "MachineUsage"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "Expense_machineUsageId_key" ON "Expense"("machineUsageId");

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_machineUsageId_fkey" FOREIGN KEY ("machineUsageId") REFERENCES "MachineUsage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Machine" ADD CONSTRAINT "Machine_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MachineEntry" ADD CONSTRAINT "MachineEntry_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "Machine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MachineEntry" ADD CONSTRAINT "MachineEntry_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MachineEntry" ADD CONSTRAINT "MachineEntry_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MachineUsage" ADD CONSTRAINT "MachineUsage_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "Machine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MachineUsage" ADD CONSTRAINT "MachineUsage_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MachineUsage" ADD CONSTRAINT "MachineUsage_costItemId_fkey" FOREIGN KEY ("costItemId") REFERENCES "CostItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MachineUsage" ADD CONSTRAINT "MachineUsage_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

