import Decimal from "decimal.js";
import { z } from "zod";
import {
  Currency,
  DocumentType,
  ExpenseKind,
  PaymentMethod,
  PaymentStatus,
} from "@/generated/prisma/enums";
import { computeExpenseAmounts, type ExpenseAmounts } from "../expenses/amounts";
import { dateInputToDate, parseDecimalInput } from "../format";
import { optionalText } from "./fields";

/** Harcama formundaki ham değerler (sayılar metin; "1.250,50" yazılabilir). */
export const expenseFormSchema = z.object({
  kind: z.enum(ExpenseKind),
  date: z.string(),
  costItemId: z.string().nullable(),
  blockId: z.string().nullable(),
  supplierId: z.string().nullable(),
  description: optionalText(500),
  amountMode: z.enum(["total", "unit"]),
  amount: z.string(),
  amountIncludesVat: z.boolean(),
  quantity: z.string(),
  unit: optionalText(20),
  unitPrice: z.string(),
  vatRate: z.string(),
  currency: z.enum(Currency),
  exchangeRate: z.string(),
  documentType: z.enum(DocumentType),
  documentNo: optionalText(60),
  paymentStatus: z.enum(PaymentStatus),
  paymentMethod: z.enum(PaymentMethod).nullable(),
  dueDate: z.string(),
  paidAt: z.string(),
  /** Aynı tedarikçide aynı belge no uyarısı görüldü ve yine de kaydedilecek */
  confirmDuplicate: z.boolean().optional(),
});

export type ExpenseFormInput = z.input<typeof expenseFormSchema>;

export type ExpenseData = {
  kind: ExpenseKind;
  date: Date;
  costItemId: string | null;
  blockId: string | null;
  supplierId: string | null;
  description: string | null;
  quantity: Decimal | null;
  unit: string | null;
  unitPrice: Decimal | null;
  currency: Currency;
  exchangeRate: Decimal;
  vatRate: Decimal;
  amounts: ExpenseAmounts;
  documentType: DocumentType;
  documentNo: string | null;
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod | null;
  dueDate: Date | null;
  paidAt: Date | null;
  confirmDuplicate: boolean;
};

type Issue = { path: string; message: string };

function decimal(raw: string, label: string, issues: Issue[], path: string, opts: { min?: number; max?: number; positive?: boolean } = {}) {
  const parsed = parseDecimalInput(raw);
  if (!parsed.ok) {
    issues.push({ path, message: `${label} geçerli bir sayı değil.` });
    return null;
  }
  const value = parsed.value;
  if (value == null) return null;
  if (opts.positive && value.lte(0)) issues.push({ path, message: `${label} sıfırdan büyük olmalı.` });
  if (opts.min != null && value.lt(opts.min)) issues.push({ path, message: `${label} en az ${opts.min} olmalı.` });
  if (opts.max != null && value.gt(opts.max)) issues.push({ path, message: `${label} en fazla ${opts.max} olabilir.` });
  return value;
}

/** Formu doğrular ve tutarları hesaplar. Hatalar alan bazında döner. */
export function parseExpenseForm(
  input: unknown,
): { ok: true; data: ExpenseData } | { ok: false; fieldErrors: Record<string, string> } {
  const shape = expenseFormSchema.safeParse(input);
  if (!shape.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of shape.error.issues) fieldErrors[issue.path.join(".") || "_"] ??= "Geçersiz değer.";
    return { ok: false, fieldErrors };
  }
  const v = shape.data;
  const issues: Issue[] = [];

  const date = dateInputToDate(v.date);
  if (!date) issues.push({ path: "date", message: "Tarih seçin." });
  if (v.kind === "EXPENSE" && !v.costItemId) issues.push({ path: "costItemId", message: "Maliyet kalemini seçin." });

  const vatRate = decimal(v.vatRate, "KDV oranı", issues, "vatRate", { min: 0, max: 100 });
  if (vatRate == null && !issues.some((i) => i.path === "vatRate")) {
    issues.push({ path: "vatRate", message: "KDV oranını seçin." });
  }

  let exchangeRate = new Decimal(1);
  if (v.currency !== "TRY") {
    const rate = decimal(v.exchangeRate, "Kur", issues, "exchangeRate", { positive: true, max: 100000 });
    if (rate == null && !issues.some((i) => i.path === "exchangeRate")) {
      issues.push({ path: "exchangeRate", message: "Döviz kurunu girin." });
    } else if (rate) exchangeRate = rate;
  }

  let quantity: Decimal | null = null;
  let unitPrice: Decimal | null = null;
  let amounts: ExpenseAmounts | null = null;
  if (v.amountMode === "unit") {
    quantity = decimal(v.quantity, "Miktar", issues, "quantity", { positive: true, max: 1e9 });
    unitPrice = decimal(v.unitPrice, "Birim fiyat", issues, "unitPrice", { positive: true, max: 1e12 });
    if (!quantity && !issues.some((i) => i.path === "quantity")) issues.push({ path: "quantity", message: "Miktarı girin." });
    if (!unitPrice && !issues.some((i) => i.path === "unitPrice")) issues.push({ path: "unitPrice", message: "Birim fiyatı girin." });
    if (quantity && unitPrice && vatRate) {
      amounts = computeExpenseAmounts({ mode: "unit", quantity, unitPrice, vatRate, exchangeRate });
    }
  } else {
    const amount = decimal(v.amount, "Tutar", issues, "amount", { positive: true, max: 1e12 });
    if (!amount && !issues.some((i) => i.path === "amount")) issues.push({ path: "amount", message: "Tutarı girin." });
    // Tek tutarla girilse de miktar/birim bilgi olarak saklanabilir.
    quantity = decimal(v.quantity, "Miktar", issues, "quantity", { positive: true, max: 1e9 });
    if (amount && vatRate) {
      amounts = computeExpenseAmounts({ mode: "total", amount, includesVat: v.amountIncludesVat, vatRate, exchangeRate });
    }
  }

  const dueDate = v.dueDate ? dateInputToDate(v.dueDate) : null;
  if (v.dueDate && !dueDate) issues.push({ path: "dueDate", message: "Vade tarihi geçersiz." });
  const paidAtInput = v.paidAt ? dateInputToDate(v.paidAt) : null;
  if (v.paidAt && !paidAtInput) issues.push({ path: "paidAt", message: "Ödeme tarihi geçersiz." });

  if (issues.length > 0 || !date || !amounts || vatRate == null) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of issues) fieldErrors[issue.path] ??= issue.message;
    return { ok: false, fieldErrors };
  }

  return {
    ok: true,
    data: {
      kind: v.kind,
      date,
      costItemId: v.costItemId,
      blockId: v.blockId,
      supplierId: v.supplierId,
      description: v.description,
      quantity,
      unit: v.unit,
      unitPrice: v.amountMode === "unit" ? unitPrice : null,
      currency: v.currency,
      exchangeRate,
      vatRate,
      amounts,
      documentType: v.documentType,
      documentNo: v.documentNo,
      paymentStatus: v.paymentStatus,
      paymentMethod: v.paymentMethod,
      dueDate,
      paidAt: v.paymentStatus === "PAID" ? (paidAtInput ?? date) : null,
      confirmDuplicate: v.confirmDuplicate ?? false,
    },
  };
}
