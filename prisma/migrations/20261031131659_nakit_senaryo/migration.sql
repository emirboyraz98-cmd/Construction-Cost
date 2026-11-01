-- CreateTable
CREATE TABLE "ScheduleEntry" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "costItemId" TEXT NOT NULL,
    "startMonth" INTEGER NOT NULL,
    "endMonth" INTEGER NOT NULL,

    CONSTRAINT "ScheduleEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CashFlowSetting" (
    "projectId" TEXT NOT NULL,
    "openingCash" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "costVatPercent" DECIMAL(5,2),
    "monthlyInflationPercent" DECIMAL(6,3) NOT NULL DEFAULT 0,
    "fxChangePercent" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "monthlyInterestPercent" DECIMAL(6,3) NOT NULL DEFAULT 0,
    "salesPerMonth" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "salesStartMonth" INTEGER,
    "downPaymentPercent" DECIMAL(5,2) NOT NULL DEFAULT 100,
    "installmentMonths" INTEGER NOT NULL DEFAULT 0,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CashFlowSetting_pkey" PRIMARY KEY ("projectId")
);

-- CreateTable
CREATE TABLE "CompanyCashSetting" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "openingCash" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "monthlyOverhead" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyCashSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Scenario" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "note" TEXT,
    "monthlyInflationPercent" DECIMAL(6,3),
    "fxChangePercent" DECIMAL(6,2),
    "monthlyInterestPercent" DECIMAL(6,3),
    "delayMonths" INTEGER NOT NULL DEFAULT 0,
    "salesPriceChangePercent" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "salesSpeedPercent" DECIMAL(6,2) NOT NULL DEFAULT 100,
    "landownerSharePercent" DECIMAL(5,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Scenario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScenarioAdjustment" (
    "id" TEXT NOT NULL,
    "scenarioId" TEXT NOT NULL,
    "costItemCode" TEXT NOT NULL,
    "changePercent" DECIMAL(6,2) NOT NULL,

    CONSTRAINT "ScenarioAdjustment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ScheduleEntry_projectId_costItemId_key" ON "ScheduleEntry"("projectId", "costItemId");

-- CreateIndex
CREATE INDEX "Scenario_projectId_idx" ON "Scenario"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "ScenarioAdjustment_scenarioId_costItemCode_key" ON "ScenarioAdjustment"("scenarioId", "costItemCode");

-- AddForeignKey
ALTER TABLE "ScheduleEntry" ADD CONSTRAINT "ScheduleEntry_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleEntry" ADD CONSTRAINT "ScheduleEntry_costItemId_fkey" FOREIGN KEY ("costItemId") REFERENCES "CostItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashFlowSetting" ADD CONSTRAINT "CashFlowSetting_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Scenario" ADD CONSTRAINT "Scenario_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScenarioAdjustment" ADD CONSTRAINT "ScenarioAdjustment_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "Scenario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
