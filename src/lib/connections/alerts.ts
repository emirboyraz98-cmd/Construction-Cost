// Bağlantı uyarıları (PLAN.md 9.7; saf modül). Eşikler ekran davranışıdır, vergi/oran değildir.
import Decimal from "decimal.js";
import type { ConnectionStatus, PaymentStatus } from "@/generated/prisma/enums";
import { formatDateOnly, formatNumber } from "../format";
import { startOfUtcDay } from "../expenses/payables";

export const ALERT_DAYS = 30;
export const PAYMENT_ALERT_DAYS = 7;
/** Kalan miktar kalem miktarının bu oranının altına düşünce uyarı */
export const LOW_REMAINING_RATIO = new Decimal("0.1");

export type ConnectionAlert = { level: "danger" | "warning"; message: string };

export type AlertInput = {
  status: ConnectionStatus;
  lastDrawDate: Date | null;
  validUntil: Date | null;
  priceFixedUntil: Date | null;
  items: { description: string; unit: string; total: Decimal; remaining: Decimal }[];
  payments: { dueDate: Date; paymentStatus: PaymentStatus }[];
  /** Ödenen − teslim alınan (bağlantı para biriminde) */
  advanceBalance: Decimal;
  currencyLabel: string;
  invoiceWarningCount: number;
};

const DAY = 86_400_000;
const daysUntil = (date: Date, today: Date) =>
  Math.round((startOfUtcDay(date).getTime() - startOfUtcDay(today).getTime()) / DAY);

function dateAlert(label: string, date: Date | null, today: Date, alerts: ConnectionAlert[], onlyIf = true) {
  if (!date || !onlyIf) return;
  const days = daysUntil(date, today);
  if (days < 0) alerts.push({ level: "danger", message: `${label} geçti (${formatDateOnly(date)}).` });
  else if (days <= ALERT_DAYS) alerts.push({ level: "warning", message: `${label} ${days === 0 ? "bugün" : `${days} gün sonra`} (${formatDateOnly(date)}).` });
}

export function connectionAlerts(input: AlertInput, today: Date): ConnectionAlert[] {
  if (input.status !== "ACTIVE") return [];
  const alerts: ConnectionAlert[] = [];
  const hasRemaining = input.items.some((item) => item.remaining.gt(0));

  dateAlert("Son çekiş tarihi", input.lastDrawDate, today, alerts, hasRemaining);
  dateAlert("Bağlantı geçerliliği", input.validUntil, today, alerts, hasRemaining);
  dateAlert("Sabit fiyat süresi", input.priceFixedUntil, today, alerts, hasRemaining);

  for (const item of input.items) {
    if (item.remaining.gt(0) && item.total.gt(0) && item.remaining.div(item.total).lte(LOW_REMAINING_RATIO)) {
      alerts.push({
        level: "warning",
        message: `${item.description}: kalan ${formatNumber(item.remaining, 4)} ${item.unit} (%${formatNumber(item.remaining.div(item.total).times(100), 0)}).`,
      });
    }
  }

  const unpaid = input.payments.filter((p) => p.paymentStatus === "UNPAID");
  const overdue = unpaid.filter((p) => daysUntil(p.dueDate, today) < 0).length;
  const soon = unpaid.filter((p) => {
    const days = daysUntil(p.dueDate, today);
    return days >= 0 && days <= PAYMENT_ALERT_DAYS;
  }).length;
  if (overdue) alerts.push({ level: "danger", message: `${overdue} ödemenin vadesi geçti.` });
  if (soon) alerts.push({ level: "warning", message: `${soon} ödemenin vadesi ${PAYMENT_ALERT_DAYS} gün içinde.` });

  const drawClosing = input.lastDrawDate ? daysUntil(input.lastDrawDate, today) <= ALERT_DAYS : false;
  if (input.advanceBalance.gt(0) && drawClosing && hasRemaining) {
    alerts.push({
      level: "danger",
      message: `Çekilmemiş avans ${formatNumber(input.advanceBalance, 2)} ${input.currencyLabel}; son çekiş tarihi yaklaşıyor.`,
    });
  }
  if (input.invoiceWarningCount > 0) {
    alerts.push({ level: "warning", message: `${input.invoiceWarningCount} fatura bağlantı fiyatı veya miktarından farklı.` });
  }
  return alerts;
}
