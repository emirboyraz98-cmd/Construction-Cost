// Vade listesi: ödenmemiş harcamaların vadeye göre gruplanması.

export type DueBucket = "overdue" | "thisWeek" | "later" | "noDueDate";

export const DUE_BUCKET_LABELS: Record<DueBucket, string> = {
  overdue: "Vadesi geçmiş",
  thisWeek: "Bu hafta (7 gün içinde)",
  later: "Daha sonra",
  noDueDate: "Vadesi girilmemiş",
};

const DAY = 86_400_000;

/** Bugünün UTC gece yarısı (DATE alanlarıyla karşılaştırmak için). */
export function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

/** "Bu hafta" bugünden itibaren 7 gündür (bugün dahil, 7. gün hariç). */
export function dueBucket(dueDate: Date | null, today: Date): DueBucket {
  if (!dueDate) return "noDueDate";
  const diff = Math.round((startOfUtcDay(dueDate).getTime() - startOfUtcDay(today).getTime()) / DAY);
  if (diff < 0) return "overdue";
  if (diff < 7) return "thisWeek";
  return "later";
}

export function addDays(date: Date, days: number): Date {
  return new Date(startOfUtcDay(date).getTime() + days * DAY);
}
