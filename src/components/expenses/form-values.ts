import { dateToDateInput, decimalToInput } from "@/lib/format";
import type { ExpenseFormValues } from "./expense-form";

export function emptyExpenseValues(today: Date, defaultVatRate: string): ExpenseFormValues {
  return {
    kind: "EXPENSE",
    date: dateToDateInput(today),
    costItemId: null,
    blockId: null,
    supplierId: null,
    description: "",
    amountMode: "total",
    amount: "",
    amountIncludesVat: true,
    quantity: "",
    unit: "",
    unitPrice: "",
    vatRate: defaultVatRate,
    currency: "TRY",
    exchangeRate: "",
    documentType: "INVOICE",
    documentNo: "",
    paymentStatus: "UNPAID",
    paymentMethod: null,
    dueDate: "",
    paidAt: "",
  };
}

type Num = { toString(): string } | null;

/** Kayıtlı harcamadan form değerleri (düzenleme veya "benzerini gir"). */
export function valuesFromExpense(expense: {
  kind: ExpenseFormValues["kind"];
  date: Date;
  costItemId: string | null;
  blockId: string | null;
  supplierId: string | null;
  description: string | null;
  quantity: Num;
  unit: string | null;
  unitPrice: Num;
  vatRate: Num;
  currency: ExpenseFormValues["currency"];
  exchangeRate: Num;
  totalAmount: Num;
  documentType: ExpenseFormValues["documentType"];
  documentNo: string | null;
  paymentStatus: ExpenseFormValues["paymentStatus"];
  paymentMethod: ExpenseFormValues["paymentMethod"];
  dueDate: Date | null;
  paidAt: Date | null;
}): ExpenseFormValues {
  const unitMode = expense.unitPrice != null && expense.quantity != null;
  return {
    kind: expense.kind,
    date: dateToDateInput(expense.date),
    costItemId: expense.costItemId,
    blockId: expense.blockId,
    supplierId: expense.supplierId,
    description: expense.description ?? "",
    amountMode: unitMode ? "unit" : "total",
    // Tek tutarla girilmiş kayıt KDV dahil toplamla açılır; matrah ve KDV aynen yeniden hesaplanır.
    amount: unitMode ? "" : decimalToInput(expense.totalAmount),
    amountIncludesVat: true,
    quantity: decimalToInput(expense.quantity),
    unit: expense.unit ?? "",
    unitPrice: decimalToInput(expense.unitPrice),
    vatRate: decimalToInput(expense.vatRate),
    currency: expense.currency,
    exchangeRate: expense.currency === "TRY" ? "" : decimalToInput(expense.exchangeRate),
    documentType: expense.documentType,
    documentNo: expense.documentNo ?? "",
    paymentStatus: expense.paymentStatus,
    paymentMethod: expense.paymentMethod,
    dueDate: dateToDateInput(expense.dueDate),
    paidAt: dateToDateInput(expense.paidAt),
  };
}
