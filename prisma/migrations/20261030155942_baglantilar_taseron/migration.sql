-- CreateEnum
CREATE TYPE "ConnectionStatus" AS ENUM ('DRAFT', 'ACTIVE', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ConnectionPriceType" AS ENUM ('FIXED', 'FX_AT_DELIVERY', 'FX_AT_PAYMENT', 'FIXED_UNTIL');

-- CreateEnum
CREATE TYPE "ContractStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SupplyMethod" AS ENUM ('TURNKEY', 'LABOR_ONLY');

-- CreateEnum
CREATE TYPE "ProgressBillingStatus" AS ENUM ('DRAFT', 'PENDING', 'APPROVED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ExpenseKind" ADD VALUE 'DELIVERY';
ALTER TYPE "ExpenseKind" ADD VALUE 'PROGRESS';
ALTER TYPE "ExpenseKind" ADD VALUE 'TRANSFER';

-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "connectionId" TEXT,
ADD COLUMN     "connectionInvoiceId" TEXT,
ADD COLUMN     "contractId" TEXT,
ADD COLUMN     "progressBillingId" TEXT;

-- AlterTable
ALTER TABLE "Expense" ADD COLUMN     "connectionId" TEXT,
ADD COLUMN     "connectionItemId" TEXT,
ADD COLUMN     "contractId" TEXT,
ADD COLUMN     "progressBillingId" TEXT,
ADD COLUMN     "transferId" TEXT;

-- CreateTable
CREATE TABLE "Connection" (
    "id" TEXT NOT NULL,
    "no" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "supplierId" TEXT NOT NULL,
    "status" "ConnectionStatus" NOT NULL DEFAULT 'ACTIVE',
    "priceType" "ConnectionPriceType" NOT NULL DEFAULT 'FIXED',
    "currency" "Currency" NOT NULL DEFAULT 'TRY',
    "priceFixedUntil" DATE,
    "validUntil" DATE,
    "lastDrawDate" DATE,
    "deliveryPlace" TEXT,
    "transportIncluded" BOOLEAN NOT NULL DEFAULT true,
    "unloadingIncluded" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Connection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConnectionItem" (
    "id" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "description" TEXT NOT NULL,
    "costItemCode" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "quantity" DECIMAL(18,4) NOT NULL,
    "unitPrice" DECIMAL(18,4) NOT NULL,
    "vatRate" DECIMAL(5,2) NOT NULL,

    CONSTRAINT "ConnectionItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConnectionAllocation" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "quantity" DECIMAL(18,4) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConnectionAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConnectionPayment" (
    "id" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "dueDate" DATE NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "description" TEXT,
    "paymentMethod" "PaymentMethod",
    "instrumentNo" TEXT,
    "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'UNPAID',
    "paidAt" DATE,
    "exchangeRate" DECIMAL(18,6) NOT NULL DEFAULT 1,
    "amountTry" DECIMAL(18,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConnectionPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConnectionInvoice" (
    "id" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "documentNo" TEXT NOT NULL,
    "exchangeRate" DECIMAL(18,6) NOT NULL DEFAULT 1,
    "netAmount" DECIMAL(18,2) NOT NULL,
    "vatAmount" DECIMAL(18,2) NOT NULL,
    "totalAmount" DECIMAL(18,2) NOT NULL,
    "totalAmountTry" DECIMAL(18,2) NOT NULL,
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConnectionInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConnectionInvoiceLine" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "quantity" DECIMAL(18,4) NOT NULL,
    "unitPrice" DECIMAL(18,4) NOT NULL,
    "vatRate" DECIMAL(5,2) NOT NULL,

    CONSTRAINT "ConnectionInvoiceLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubcontractContract" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "no" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "title" TEXT NOT NULL,
    "scope" TEXT,
    "supplyMethod" "SupplyMethod" NOT NULL DEFAULT 'TURNKEY',
    "vatRate" DECIMAL(5,2) NOT NULL,
    "vatWithholdingRate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "retentionRate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "advanceOffsetRate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "status" "ContractStatus" NOT NULL DEFAULT 'ACTIVE',
    "startDate" DATE,
    "endDate" DATE,
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubcontractContract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContractItem" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "costItemId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "quantity" DECIMAL(18,4) NOT NULL,
    "unitPrice" DECIMAL(18,4) NOT NULL,

    CONSTRAINT "ContractItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProgressBilling" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "periodStart" DATE,
    "periodEnd" DATE,
    "status" "ProgressBillingStatus" NOT NULL DEFAULT 'DRAFT',
    "grossAmount" DECIMAL(18,2) NOT NULL,
    "vatRate" DECIMAL(5,2) NOT NULL,
    "vatAmount" DECIMAL(18,2) NOT NULL,
    "vatWithheld" DECIMAL(18,2) NOT NULL,
    "retention" DECIMAL(18,2) NOT NULL,
    "advanceOffset" DECIMAL(18,2) NOT NULL,
    "materialOffset" DECIMAL(18,2) NOT NULL,
    "otherDeductions" DECIMAL(18,2) NOT NULL,
    "otherDeductionNote" TEXT,
    "payableAmount" DECIMAL(18,2) NOT NULL,
    "dueDate" DATE,
    "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'UNPAID',
    "paymentMethod" "PaymentMethod",
    "paidAt" DATE,
    "notes" TEXT,
    "rejectionNote" TEXT,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProgressBilling_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProgressBillingLine" (
    "id" TEXT NOT NULL,
    "billingId" TEXT NOT NULL,
    "contractItemId" TEXT NOT NULL,
    "cumulativeQuantity" DECIMAL(18,4) NOT NULL,
    "previousQuantity" DECIMAL(18,4) NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,

    CONSTRAINT "ProgressBillingLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaterialTransfer" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "fromProjectId" TEXT NOT NULL,
    "toProjectId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "costItemCode" TEXT NOT NULL,
    "quantity" DECIMAL(18,4),
    "unit" TEXT,
    "amount" DECIMAL(18,2) NOT NULL,
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "MaterialTransfer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Connection_no_key" ON "Connection"("no");

-- CreateIndex
CREATE INDEX "Connection_supplierId_idx" ON "Connection"("supplierId");

-- CreateIndex
CREATE INDEX "Connection_status_idx" ON "Connection"("status");

-- CreateIndex
CREATE INDEX "ConnectionItem_connectionId_idx" ON "ConnectionItem"("connectionId");

-- CreateIndex
CREATE INDEX "ConnectionAllocation_projectId_idx" ON "ConnectionAllocation"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "ConnectionAllocation_itemId_projectId_key" ON "ConnectionAllocation"("itemId", "projectId");

-- CreateIndex
CREATE INDEX "ConnectionPayment_connectionId_idx" ON "ConnectionPayment"("connectionId");

-- CreateIndex
CREATE INDEX "ConnectionPayment_paymentStatus_dueDate_idx" ON "ConnectionPayment"("paymentStatus", "dueDate");

-- CreateIndex
CREATE INDEX "ConnectionInvoice_connectionId_idx" ON "ConnectionInvoice"("connectionId");

-- CreateIndex
CREATE INDEX "ConnectionInvoice_date_idx" ON "ConnectionInvoice"("date");

-- CreateIndex
CREATE INDEX "ConnectionInvoiceLine_invoiceId_idx" ON "ConnectionInvoiceLine"("invoiceId");

-- CreateIndex
CREATE INDEX "ConnectionInvoiceLine_itemId_idx" ON "ConnectionInvoiceLine"("itemId");

-- CreateIndex
CREATE INDEX "SubcontractContract_supplierId_idx" ON "SubcontractContract"("supplierId");

-- CreateIndex
CREATE UNIQUE INDEX "SubcontractContract_projectId_no_key" ON "SubcontractContract"("projectId", "no");

-- CreateIndex
CREATE INDEX "ContractItem_contractId_idx" ON "ContractItem"("contractId");

-- CreateIndex
CREATE INDEX "ProgressBilling_projectId_status_idx" ON "ProgressBilling"("projectId", "status");

-- CreateIndex
CREATE INDEX "ProgressBilling_paymentStatus_dueDate_idx" ON "ProgressBilling"("paymentStatus", "dueDate");

-- CreateIndex
CREATE UNIQUE INDEX "ProgressBilling_contractId_seq_key" ON "ProgressBilling"("contractId", "seq");

-- CreateIndex
CREATE UNIQUE INDEX "ProgressBillingLine_billingId_contractItemId_key" ON "ProgressBillingLine"("billingId", "contractItemId");

-- CreateIndex
CREATE INDEX "MaterialTransfer_fromProjectId_idx" ON "MaterialTransfer"("fromProjectId");

-- CreateIndex
CREATE INDEX "MaterialTransfer_toProjectId_idx" ON "MaterialTransfer"("toProjectId");

-- CreateIndex
CREATE INDEX "Document_connectionId_idx" ON "Document"("connectionId");

-- CreateIndex
CREATE INDEX "Document_connectionInvoiceId_idx" ON "Document"("connectionInvoiceId");

-- CreateIndex
CREATE INDEX "Document_contractId_idx" ON "Document"("contractId");

-- CreateIndex
CREATE INDEX "Document_progressBillingId_idx" ON "Document"("progressBillingId");

-- CreateIndex
CREATE INDEX "Expense_connectionItemId_idx" ON "Expense"("connectionItemId");

-- CreateIndex
CREATE INDEX "Expense_connectionId_idx" ON "Expense"("connectionId");

-- CreateIndex
CREATE INDEX "Expense_contractId_idx" ON "Expense"("contractId");

-- CreateIndex
CREATE INDEX "Expense_progressBillingId_idx" ON "Expense"("progressBillingId");

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "Connection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_connectionItemId_fkey" FOREIGN KEY ("connectionItemId") REFERENCES "ConnectionItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "SubcontractContract"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_progressBillingId_fkey" FOREIGN KEY ("progressBillingId") REFERENCES "ProgressBilling"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_transferId_fkey" FOREIGN KEY ("transferId") REFERENCES "MaterialTransfer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "Connection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_connectionInvoiceId_fkey" FOREIGN KEY ("connectionInvoiceId") REFERENCES "ConnectionInvoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "SubcontractContract"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_progressBillingId_fkey" FOREIGN KEY ("progressBillingId") REFERENCES "ProgressBilling"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Connection" ADD CONSTRAINT "Connection_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Connection" ADD CONSTRAINT "Connection_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConnectionItem" ADD CONSTRAINT "ConnectionItem_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "Connection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConnectionAllocation" ADD CONSTRAINT "ConnectionAllocation_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "ConnectionItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConnectionAllocation" ADD CONSTRAINT "ConnectionAllocation_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConnectionPayment" ADD CONSTRAINT "ConnectionPayment_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "Connection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConnectionInvoice" ADD CONSTRAINT "ConnectionInvoice_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "Connection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConnectionInvoiceLine" ADD CONSTRAINT "ConnectionInvoiceLine_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "ConnectionInvoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConnectionInvoiceLine" ADD CONSTRAINT "ConnectionInvoiceLine_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "ConnectionItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubcontractContract" ADD CONSTRAINT "SubcontractContract_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubcontractContract" ADD CONSTRAINT "SubcontractContract_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubcontractContract" ADD CONSTRAINT "SubcontractContract_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractItem" ADD CONSTRAINT "ContractItem_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "SubcontractContract"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractItem" ADD CONSTRAINT "ContractItem_costItemId_fkey" FOREIGN KEY ("costItemId") REFERENCES "CostItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgressBilling" ADD CONSTRAINT "ProgressBilling_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "SubcontractContract"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgressBilling" ADD CONSTRAINT "ProgressBilling_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgressBilling" ADD CONSTRAINT "ProgressBilling_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgressBilling" ADD CONSTRAINT "ProgressBilling_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgressBillingLine" ADD CONSTRAINT "ProgressBillingLine_billingId_fkey" FOREIGN KEY ("billingId") REFERENCES "ProgressBilling"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgressBillingLine" ADD CONSTRAINT "ProgressBillingLine_contractItemId_fkey" FOREIGN KEY ("contractItemId") REFERENCES "ContractItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialTransfer" ADD CONSTRAINT "MaterialTransfer_fromProjectId_fkey" FOREIGN KEY ("fromProjectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialTransfer" ADD CONSTRAINT "MaterialTransfer_toProjectId_fkey" FOREIGN KEY ("toProjectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialTransfer" ADD CONSTRAINT "MaterialTransfer_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
