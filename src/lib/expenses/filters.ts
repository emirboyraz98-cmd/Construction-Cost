// Harcama listesi filtreleri: adres çubuğundaki sorgu parametreleri ↔ filtre nesnesi.
import { ApprovalStatus, ExpenseKind, PaymentStatus } from "@/generated/prisma/enums";
import { dateInputToDate } from "../format";

export type ExpenseFilters = {
  from: Date | null;
  to: Date | null;
  costItemId: string | null;
  supplierId: string | null;
  blockId: string | null;
  status: ApprovalStatus | null;
  payment: PaymentStatus | null;
  kind: ExpenseKind | null;
  query: string | null;
  missingDocument: boolean;
  page: number;
};

type SearchParams = Record<string, string | string[] | undefined>;

function one(params: SearchParams, key: string): string | null {
  const value = params[key];
  const text = Array.isArray(value) ? value[0] : value;
  return text?.trim() ? text.trim() : null;
}

function oneOf<T extends string>(value: string | null, allowed: readonly T[]): T | null {
  return value && (allowed as readonly string[]).includes(value) ? (value as T) : null;
}

export function parseExpenseFilters(params: SearchParams): ExpenseFilters {
  const page = Number(one(params, "page") ?? 1);
  return {
    from: dateInputToDate(one(params, "from")),
    to: dateInputToDate(one(params, "to")),
    costItemId: one(params, "item"),
    supplierId: one(params, "supplier"),
    blockId: one(params, "block"),
    status: oneOf(one(params, "status"), Object.values(ApprovalStatus)),
    payment: oneOf(one(params, "payment"), Object.values(PaymentStatus)),
    kind: oneOf(one(params, "kind"), Object.values(ExpenseKind)),
    query: one(params, "q")?.slice(0, 100) ?? null,
    missingDocument: one(params, "nodoc") === "1",
    page: Number.isInteger(page) && page > 0 ? page : 1,
  };
}

const toInput = (date: Date | null) => (date ? date.toISOString().slice(0, 10) : null);

export function filtersToSearchParams(filters: Partial<ExpenseFilters>): URLSearchParams {
  const params = new URLSearchParams();
  const set = (key: string, value: string | null | undefined) => value && params.set(key, value);
  set("from", toInput(filters.from ?? null));
  set("to", toInput(filters.to ?? null));
  set("item", filters.costItemId);
  set("supplier", filters.supplierId);
  set("block", filters.blockId);
  set("status", filters.status);
  set("payment", filters.payment);
  set("kind", filters.kind);
  set("q", filters.query);
  if (filters.missingDocument) params.set("nodoc", "1");
  if (filters.page && filters.page > 1) params.set("page", String(filters.page));
  return params;
}

export function hasActiveFilters(filters: ExpenseFilters): boolean {
  return Object.entries(filters).some(([key, value]) => key !== "page" && value !== null && value !== false);
}
