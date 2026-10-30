// Kayıt türlerinin anlamı: hangisi maliyete yazılır, hangisi ödenecek borçtur (saf modül).
import type { ExpenseKind } from "@/generated/prisma/enums";

/**
 * Maliyete yazılan türler. Avans maliyet değildir; bağlantı malzemesinin maliyeti ödemede değil
 * çekişte (DELIVERY), taşeronun maliyeti hakediş onayında (PROGRESS) oluşur (PLAN.md 9.4, 8.2).
 */
export const COST_KINDS: readonly ExpenseKind[] = ["EXPENSE", "DELIVERY", "PROGRESS", "TRANSFER"];

/**
 * Ödeme durumu izlenen (vade listesine giren) türler. Çekişin ödemesi bağlantının ödeme planında,
 * hakedişin ödemesi hakediş kaydında izlenir; bu satırlar yalnızca maliyet içindir.
 */
export const PAYABLE_KINDS: readonly ExpenseKind[] = ["EXPENSE", "ADVANCE"];

export const isCostKind = (kind: ExpenseKind) => COST_KINDS.includes(kind);
export const isPayableKind = (kind: ExpenseKind) => PAYABLE_KINDS.includes(kind);

/** Elle girilen / düzenlenebilen türler; diğerleri bağlantı, hakediş veya transfer ekranından oluşur. */
export const MANUAL_KINDS: readonly ExpenseKind[] = ["EXPENSE", "ADVANCE"];
export const isManualKind = (kind: ExpenseKind) => MANUAL_KINDS.includes(kind);
