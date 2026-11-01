import "server-only";
import Decimal from "decimal.js";
import type { MachineEntryType, MachineStatus, MachineUsageUnit } from "@/generated/prisma/enums";
import { projectRole } from "@/lib/auth/access";
import { hasCapability } from "@/lib/auth/roles";
import { monthIndex } from "@/lib/cashflow/cashflow";
import { compareCodes } from "@/lib/cost-tree/tree";
import { MACHINE_UNIT_LABELS } from "@/lib/machines/labels";
import { combineMachineFlows, machineCashEvents, machineCashFlow, usageAmount } from "@/lib/machines/machines";
import { ActionError, getAccess, requireGlobalCapability } from "./access";
import { writeAudit } from "./audit";
import { db } from "./db";

// İş makineleri (makine parkı): şirket geneli kayıt. Nakit hareketleri şirket kasasına,
// puantaj ise projeye iç maliyet (Expense, MACHINE) olarak yazılır.

const dec = (v: { toString(): string } | null | undefined) => new Decimal(v?.toString() ?? 0);

const entrySelect = { id: true, date: true, type: true, amount: true, paid: true, dueDate: true } as const;
const usageSelect = { id: true, date: true, quantity: true, amount: true } as const;

const toEntryInput = (e: { date: Date; type: MachineEntryType; amount: { toString(): string }; paid: boolean; dueDate: Date | null }) => ({ ...e, amount: dec(e.amount) });
const toUsageInput = (u: { date: Date; quantity: { toString(): string }; amount: { toString(): string } }) => ({ date: u.date, quantity: dec(u.quantity), amount: dec(u.amount) });

/** Makine listesi, her makinenin özeti ve filo toplamı. */
export async function listMachines() {
  const { user } = await requireGlobalCapability("machine.view");
  const currentMonth = monthIndex(new Date());
  const machines = await db.machine.findMany({
    where: { deletedAt: null },
    orderBy: [{ status: "asc" }, { code: "asc" }],
    include: {
      entries: { where: { deletedAt: null }, select: entrySelect },
      usages: { where: { deletedAt: null }, select: usageSelect },
    },
  });
  const rows = machines.map((m) => {
    const flow = machineCashFlow(m.entries.map(toEntryInput), m.usages.map(toUsageInput), currentMonth);
    const thisMonth = flow.rows.find((r) => r.month === currentMonth);
    return {
      id: m.id,
      code: m.code,
      name: m.name,
      category: m.category,
      status: m.status,
      usageUnit: m.usageUnit,
      internalRate: m.internalRate,
      flow,
      thisMonthQty: thisMonth?.usageQty ?? new Decimal(0),
    };
  });
  const fleet = combineMachineFlows(rows.filter((r) => r.flow.rows.length > 0).map((r) => r.flow), currentMonth);
  return { canManage: hasCapability(user.role, "machine.manage"), machines: rows, fleet, currentMonth };
}

/** Makine detayı: hareketler, puantaj, aylık akış ve form seçenekleri. */
export async function getMachine(id: string) {
  const { user, scope } = await requireGlobalCapability("machine.view");
  const currentMonth = monthIndex(new Date());
  const machine = await db.machine.findFirst({
    where: { id, deletedAt: null },
    include: {
      entries: { where: { deletedAt: null }, orderBy: [{ date: "desc" }, { createdAt: "desc" }], include: { project: { select: { id: true, name: true } } } },
      usages: {
        where: { deletedAt: null },
        orderBy: [{ date: "desc" }, { createdAt: "desc" }],
        include: { project: { select: { id: true, name: true } }, costItem: { select: { code: true, name: true } } },
      },
    },
  });
  if (!machine) return null;
  const flow = machineCashFlow(machine.entries.map(toEntryInput), machine.usages.map(toUsageInput), currentMonth);
  const canManage = hasCapability(user.role, "machine.manage");
  // Puantaj ve hareket formu: kullanıcının görebildiği açık projeler ve maliyet kalemleri
  const projects = canManage
    ? (await db.project.findMany({ where: { status: { not: "ARCHIVED" } }, select: { id: true, name: true }, orderBy: { name: "asc" } })).filter((p) => projectRole(scope, p.id))
    : [];
  const items = projects.length
    ? await db.costItem.findMany({ where: { projectId: { in: projects.map((p) => p.id) }, active: true }, select: { id: true, projectId: true, code: true, name: true } })
    : [];
  const costItems: Record<string, { id: string; code: string; name: string }[]> = {};
  for (const i of items.sort((a, b) => compareCodes(a.code, b.code))) (costItems[i.projectId] ??= []).push({ id: i.id, code: i.code, name: i.name });
  return {
    machine,
    flow,
    currentMonth,
    canManage,
    projects,
    costItems,
    // Projesini göremediği puantajın tutarı gizlenmez (makinenin maliyeti şirketindir), proje adı gizlenir.
    usageProjectVisible: Object.fromEntries(machine.usages.map((u) => [u.id, projectRole(scope, u.projectId) !== null])),
  };
}

export type MachineData = {
  code: string;
  name: string;
  category: string | null;
  brand: string | null;
  model: string | null;
  plateOrSerial: string | null;
  year: number | null;
  status: MachineStatus;
  usageUnit: MachineUsageUnit;
  internalRate: Decimal | null;
  notes: string | null;
};

export async function saveMachine(id: string | null, data: MachineData) {
  const { user } = await requireGlobalCapability("machine.manage");
  const clash = await db.machine.findFirst({ where: { code: data.code, deletedAt: null, ...(id ? { NOT: { id } } : {}) }, select: { id: true } });
  if (clash) throw new ActionError(`“${data.code}” kodlu makine zaten var.`);
  return db.$transaction(async (tx) => {
    const saved = id ? await tx.machine.update({ where: { id }, data }) : await tx.machine.create({ data: { ...data, createdById: user.id } });
    await writeAudit(tx, { userId: user.id, action: id ? "update" : "create", entity: "Machine", entityId: saved.id, changes: { code: data.code, name: data.name } });
    return saved.id;
  });
}

export async function deleteMachine(id: string) {
  const { user } = await requireGlobalCapability("machine.manage");
  const used = await db.machineUsage.count({ where: { machineId: id, deletedAt: null } });
  if (used) throw new ActionError("Puantajı olan makine silinemez; durumunu “Satıldı” veya “Hurdaya ayrıldı” yapın.");
  await db.$transaction(async (tx) => {
    await tx.machine.update({ where: { id }, data: { deletedAt: new Date() } });
    await writeAudit(tx, { userId: user.id, action: "delete", entity: "Machine", entityId: id });
  });
}

export type MachineEntryData = {
  date: Date;
  type: MachineEntryType;
  amount: Decimal;
  description: string | null;
  quantity: Decimal | null;
  unit: string | null;
  paid: boolean;
  dueDate: Date | null;
  projectId: string | null;
  counterparty: string | null;
};

export async function addMachineEntry(machineId: string, data: MachineEntryData) {
  const { user, scope } = await requireGlobalCapability("machine.manage");
  if (!(await db.machine.count({ where: { id: machineId, deletedAt: null } }))) throw new ActionError("Makine bulunamadı.");
  if (data.projectId && !projectRole(scope, data.projectId)) throw new ActionError("Bu projeye yetkiniz yok.");
  if (!data.paid && !data.dueDate) throw new ActionError("Ödenmemiş hareket için vade girin.");
  await db.$transaction(async (tx) => {
    const saved = await tx.machineEntry.create({ data: { ...data, machineId, createdById: user.id } });
    await writeAudit(tx, { userId: user.id, action: "create", entity: "MachineEntry", entityId: saved.id, changes: { type: data.type, amount: data.amount.toString() } });
  });
}

export async function setMachineEntryPaid(entryId: string, paid: boolean) {
  const { user } = await requireGlobalCapability("machine.manage");
  await db.$transaction(async (tx) => {
    await tx.machineEntry.update({ where: { id: entryId }, data: { paid } });
    await writeAudit(tx, { userId: user.id, action: paid ? "pay" : "update", entity: "MachineEntry", entityId: entryId, changes: { paid } });
  });
}

export async function deleteMachineEntry(entryId: string) {
  const { user } = await requireGlobalCapability("machine.manage");
  await db.$transaction(async (tx) => {
    await tx.machineEntry.update({ where: { id: entryId }, data: { deletedAt: new Date() } });
    await writeAudit(tx, { userId: user.id, action: "delete", entity: "MachineEntry", entityId: entryId });
  });
}

export type MachineUsageData = { date: Date; projectId: string; costItemId: string; quantity: Decimal; rate: Decimal; description: string | null };

/** Puantaj: makine çalışması projeye iç maliyet olarak yazılır (onaylı, ödenecek borç oluşturmaz). */
export async function addMachineUsage(machineId: string, data: MachineUsageData) {
  const { user, scope } = await requireGlobalCapability("machine.manage");
  if (!projectRole(scope, data.projectId)) throw new ActionError("Bu projeye yetkiniz yok.");
  const machine = await db.machine.findFirst({ where: { id: machineId, deletedAt: null } });
  if (!machine) throw new ActionError("Makine bulunamadı.");
  const item = await db.costItem.findFirst({ where: { id: data.costItemId, projectId: data.projectId }, select: { active: true } });
  if (!item) throw new ActionError("Maliyet kalemi bu projede yok.");
  if (!item.active) throw new ActionError("Pasif maliyet kalemine yazılamaz.");
  const amount = usageAmount(data.quantity, data.rate);
  const unit = MACHINE_UNIT_LABELS[machine.usageUnit];
  await db.$transaction(async (tx) => {
    const usage = await tx.machineUsage.create({ data: { ...data, amount, machineId, createdById: user.id } });
    await tx.expense.create({
      data: {
        projectId: data.projectId,
        kind: "MACHINE",
        date: data.date,
        costItemId: data.costItemId,
        description: `${machine.code} ${machine.name} – ${data.quantity.toString().replace(".", ",")} ${unit}${data.description ? ` · ${data.description}` : ""}`,
        quantity: data.quantity,
        unit,
        unitPrice: data.rate,
        currency: "TRY",
        exchangeRate: 1,
        vatRate: 0,
        netAmount: amount,
        vatAmount: 0,
        totalAmount: amount,
        netAmountTry: amount,
        vatAmountTry: 0,
        totalAmountTry: amount,
        documentType: "NONE",
        machineUsageId: usage.id,
        approvalStatus: "APPROVED",
        approvedById: user.id,
        approvedAt: new Date(),
        createdById: user.id,
      },
    });
    await writeAudit(tx, { userId: user.id, projectId: data.projectId, action: "create", entity: "MachineUsage", entityId: usage.id, changes: { machine: machine.code, quantity: data.quantity.toString(), amount: amount.toString() } });
  });
  return amount;
}

export async function deleteMachineUsage(usageId: string) {
  const { user, scope } = await requireGlobalCapability("machine.manage");
  const usage = await db.machineUsage.findUnique({ where: { id: usageId }, select: { projectId: true } });
  if (!usage) throw new ActionError("Puantaj bulunamadı.");
  if (!projectRole(scope, usage.projectId)) throw new ActionError("Bu projeye yetkiniz yok.");
  const now = new Date();
  await db.$transaction(async (tx) => {
    await tx.machineUsage.update({ where: { id: usageId }, data: { deletedAt: now } });
    await tx.expense.updateMany({ where: { machineUsageId: usageId }, data: { deletedAt: now } });
    await writeAudit(tx, { userId: user.id, projectId: usage.projectId, action: "delete", entity: "MachineUsage", entityId: usageId });
  });
}

/** Şirket geneli nakit akışı için makine nakit hareketleri (iç kullanım hariç). */
export async function machineCompanyEvents() {
  await getAccess();
  const entries = await db.machineEntry.findMany({ where: { deletedAt: null, machine: { deletedAt: null } }, select: entrySelect });
  return machineCashEvents(entries.map(toEntryInput), monthIndex(new Date()));
}
