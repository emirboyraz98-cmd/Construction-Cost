-- CreateEnum
CREATE TYPE "Currency" AS ENUM ('TRY', 'USD', 'EUR', 'GBP');

-- CreateEnum
CREATE TYPE "SupplierKind" AS ENUM ('SUPPLIER', 'SUBCONTRACTOR', 'BOTH');

-- CreateEnum
CREATE TYPE "RateSource" AS ENUM ('TCMB', 'MANUAL');

-- CreateEnum
CREATE TYPE "ExpenseKind" AS ENUM ('EXPENSE', 'ADVANCE');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('INVOICE', 'DELIVERY_NOTE', 'RECEIPT', 'PROGRESS_BILLING', 'VOUCHER', 'NONE');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('UNPAID', 'PAID');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'BANK_TRANSFER', 'CHEQUE', 'PROMISSORY_NOTE', 'CREDIT_CARD');

-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "Supplier" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "taxNumber" TEXT,
    "taxOffice" TEXT,
    "kind" "SupplierKind" NOT NULL DEFAULT 'SUPPLIER',
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "iban" TEXT,
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExchangeRate" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "currency" "Currency" NOT NULL,
    "buying" DECIMAL(18,6) NOT NULL,
    "selling" DECIMAL(18,6) NOT NULL,
    "source" "RateSource" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExchangeRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Expense" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "blockId" TEXT,
    "costItemId" TEXT,
    "supplierId" TEXT,
    "kind" "ExpenseKind" NOT NULL DEFAULT 'EXPENSE',
    "date" DATE NOT NULL,
    "description" TEXT,
    "quantity" DECIMAL(18,4),
    "unit" TEXT,
    "unitPrice" DECIMAL(18,4),
    "currency" "Currency" NOT NULL DEFAULT 'TRY',
    "exchangeRate" DECIMAL(18,6) NOT NULL DEFAULT 1,
    "vatRate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "netAmount" DECIMAL(18,2) NOT NULL,
    "vatAmount" DECIMAL(18,2) NOT NULL,
    "totalAmount" DECIMAL(18,2) NOT NULL,
    "netAmountTry" DECIMAL(18,2) NOT NULL,
    "vatAmountTry" DECIMAL(18,2) NOT NULL,
    "totalAmountTry" DECIMAL(18,2) NOT NULL,
    "documentType" "DocumentType" NOT NULL,
    "documentNo" TEXT,
    "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'UNPAID',
    "paymentMethod" "PaymentMethod",
    "dueDate" DATE,
    "paidAt" DATE,
    "approvalStatus" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "approvalNote" TEXT,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "splitGroupId" TEXT,
    "splitRatio" DECIMAL(9,6),
    "importId" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "expenseId" TEXT,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExpenseImport" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "fileName" TEXT,
    "rowCount" INTEGER NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExpenseImport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Supplier_name_idx" ON "Supplier"("name");

-- CreateIndex
CREATE INDEX "Supplier_taxNumber_idx" ON "Supplier"("taxNumber");

-- CreateIndex
CREATE UNIQUE INDEX "ExchangeRate_date_currency_key" ON "ExchangeRate"("date", "currency");

-- CreateIndex
CREATE INDEX "Expense_projectId_date_idx" ON "Expense"("projectId", "date");

-- CreateIndex
CREATE INDEX "Expense_projectId_approvalStatus_idx" ON "Expense"("projectId", "approvalStatus");

-- CreateIndex
CREATE INDEX "Expense_projectId_costItemId_idx" ON "Expense"("projectId", "costItemId");

-- CreateIndex
CREATE INDEX "Expense_supplierId_documentNo_idx" ON "Expense"("supplierId", "documentNo");

-- CreateIndex
CREATE INDEX "Expense_paymentStatus_dueDate_idx" ON "Expense"("paymentStatus", "dueDate");

-- CreateIndex
CREATE INDEX "Expense_splitGroupId_idx" ON "Expense"("splitGroupId");

-- CreateIndex
CREATE UNIQUE INDEX "Document_storageKey_key" ON "Document"("storageKey");

-- CreateIndex
CREATE INDEX "Document_expenseId_idx" ON "Document"("expenseId");

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_blockId_fkey" FOREIGN KEY ("blockId") REFERENCES "Block"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_costItemId_fkey" FOREIGN KEY ("costItemId") REFERENCES "CostItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_importId_fkey" FOREIGN KEY ("importId") REFERENCES "ExpenseImport"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "Expense"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseImport" ADD CONSTRAINT "ExpenseImport_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseImport" ADD CONSTRAINT "ExpenseImport_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
