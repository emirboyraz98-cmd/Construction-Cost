import "server-only";
import Decimal from "decimal.js";
import type { Role } from "@/generated/prisma/enums";
import { projectRole } from "@/lib/auth/access";
import { hasCapability, type Capability } from "@/lib/auth/roles";
import { PAYABLE_KINDS } from "@/lib/expenses/kinds";
import { reservationActive } from "@/lib/sales/sales";
import { getAccess } from "./access";
import { connectionAlertOverview } from "./connections";
import { db } from "./db";
import { salesSummaries } from "./sales";

// Bildirim merkezi (Faz 8): kullanıcının rolüne ve projelerine göre yapılacak işler ve uyarılar.
// Kayıt tutulmaz; her açılışta güncel durumdan üretilir (okunan iş listeden kendiliğinden düşer).

export type NotificationItem = {
  key: string;
  level: "danger" | "warning" | "info";
  title: string;
  detail: string;
  href: string;
};

const dec = (v: { toString(): string } | null | undefined) => new Decimal(v?.toString() ?? 0);
const tl = (v: Decimal) => `${new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 0 }).format(Number(v.toFixed(0)))} ₺`;
const DAY = 86_400_000;

export async function getNotifications(): Promise<NotificationItem[]> {
  const { user, scope } = await getAccess();
  const projects = await db.project.findMany({ where: { status: { not: "ARCHIVED" } }, select: { id: true, name: true } });
  const visible = projects.filter((p) => projectRole(scope, p.id));
  const name = new Map(visible.map((p) => [p.id, p.name]));
  const withCap = (cap: Capability) => visible.filter((p) => hasCapability(projectRole(scope, p.id) as Role, cap)).map((p) => p.id);
  const now = new Date();
  const today = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const inDays = (n: number) => new Date(today.getTime() + n * DAY);
  const items: NotificationItem[] = [];

  const approve = withCap("expense.approve");
  const manage = withCap("expense.manage");
  const salesView = withCap("sales.view");
  const salesManage = withCap("sales.manage");
  const collect = withCap("collection.manage");

  const [pending, billings, rejected, overdue, dueSoon, reservations, cheques] = await Promise.all([
    approve.length ? db.expense.groupBy({ by: ["projectId"], where: { projectId: { in: approve }, deletedAt: null, approvalStatus: "PENDING" }, _count: { _all: true } }) : [],
    withCap("progress.approve").length
      ? db.progressBilling.groupBy({ by: ["projectId"], where: { projectId: { in: withCap("progress.approve") }, status: "PENDING" }, _count: { _all: true } })
      : [],
    db.expense.groupBy({ by: ["projectId"], where: { projectId: { in: visible.map((p) => p.id) }, createdById: user.id, deletedAt: null, approvalStatus: "REJECTED" }, _count: { _all: true } }),
    manage.length
      ? db.expense.aggregate({ where: { projectId: { in: manage }, deletedAt: null, kind: { in: [...PAYABLE_KINDS] }, paymentStatus: "UNPAID", approvalStatus: { not: "REJECTED" }, dueDate: { lt: today } }, _count: { _all: true }, _sum: { totalAmountTry: true } })
      : null,
    manage.length
      ? db.expense.aggregate({ where: { projectId: { in: manage }, deletedAt: null, kind: { in: [...PAYABLE_KINDS] }, paymentStatus: "UNPAID", approvalStatus: { not: "REJECTED" }, dueDate: { gte: today, lte: inDays(7) } }, _count: { _all: true }, _sum: { totalAmountTry: true } })
      : null,
    salesManage.length ? db.reservation.findMany({ where: { projectId: { in: salesManage }, status: "ACTIVE", expiresAt: { gte: today, lte: inDays(2) } }, include: { unit: { select: { doorNo: true, block: { select: { name: true } } } }, customer: { select: { name: true } } } }) : [],
    collect.length
      ? db.collection.findMany({ where: { chequeStatus: "PENDING", chequeDueDate: { lte: inDays(7) }, contract: { projectId: { in: collect }, status: "ACTIVE" } }, include: { contract: { select: { projectId: true, currency: true } } } })
      : [],
  ]);

  for (const p of pending) {
    items.push({ key: `approve:${p.projectId}`, level: "warning", title: `${p._count._all} harcama onay bekliyor`, detail: name.get(p.projectId)!, href: `/projects/${p.projectId}/expenses?status=PENDING` });
  }
  for (const b of billings) {
    items.push({ key: `billing:${b.projectId}`, level: "warning", title: `${b._count._all} hakediş onay bekliyor`, detail: name.get(b.projectId)!, href: `/projects/${b.projectId}/contracts` });
  }
  for (const r of rejected) {
    items.push({ key: `rejected:${r.projectId}`, level: "warning", title: `Reddedilen ${r._count._all} kaydınız var`, detail: `${name.get(r.projectId)} · nedenini görüp düzeltin`, href: `/projects/${r.projectId}/expenses?status=REJECTED` });
  }
  if (overdue && overdue._count._all > 0) {
    items.push({ key: "payables:overdue", level: "danger", title: `${overdue._count._all} ödemenin vadesi geçti`, detail: `${tl(dec(overdue._sum.totalAmountTry))} · harcama ve avanslar`, href: "/company/payables" });
  }
  if (dueSoon && dueSoon._count._all > 0) {
    items.push({ key: "payables:week", level: "info", title: `7 gün içinde ${dueSoon._count._all} ödeme`, detail: tl(dec(dueSoon._sum.totalAmountTry)), href: "/company/payables" });
  }
  const connectionAlerts = await connectionAlertOverview();
  if (connectionAlerts?.length) {
    const danger = connectionAlerts.filter((c) => c.alerts.some((a) => a.level === "danger")).length;
    items.push({ key: "connections", level: danger ? "danger" : "warning", title: `${connectionAlerts.length} bağlantıda uyarı`, detail: connectionAlerts.slice(0, 2).map((c) => `${c.no}: ${c.alerts[0].message}`).join(" · "), href: "/company/connections" });
  }
  if (salesView.length) {
    const summaries = await salesSummaries(salesView);
    for (const [projectId, s] of summaries) {
      if (s.overdueCount > 0) items.push({ key: `installments:${projectId}`, level: "danger", title: `${s.overdueCount} taksit gecikmiş`, detail: `${name.get(projectId)} · ${tl(s.overdueTry)}`, href: `/projects/${projectId}/collections` });
    }
  }
  for (const r of reservations.filter((x) => reservationActive(x, today))) {
    items.push({ key: `reservation:${r.id}`, level: "info", title: `Rezervasyon bitiyor: ${r.unit.block.name} No ${r.unit.doorNo}`, detail: `${name.get(r.projectId)} · ${r.customer.name} · ${r.expiresAt.toLocaleDateString("tr-TR")}`, href: `/projects/${r.projectId}/sales` });
  }
  const chequeByProject = new Map<string, { count: number; past: number }>();
  for (const c of cheques) {
    const e = chequeByProject.get(c.contract.projectId) ?? { count: 0, past: 0 };
    e.count++;
    if (c.chequeDueDate && c.chequeDueDate < today) e.past++;
    chequeByProject.set(c.contract.projectId, e);
  }
  for (const [projectId, e] of chequeByProject) {
    items.push({
      key: `cheques:${projectId}`,
      level: e.past ? "warning" : "info",
      title: e.past ? `${e.past} çek / senedin vadesi geldi` : `${e.count} çek / senedin vadesi yaklaşıyor`,
      detail: `${name.get(projectId)} · tahsil edildi veya karşılıksız olarak işaretleyin`,
      href: `/projects/${projectId}/collections`,
    });
  }
  const order = { danger: 0, warning: 1, info: 2 } as const;
  return items.sort((a, b) => order[a.level] - order[b.level]);
}
