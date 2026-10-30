// Harcama ekranlarında gösterilen Türkçe etiketler (veritabanı değerleri İngilizce).
import {
  ApprovalStatus,
  Currency,
  DocumentType,
  ExpenseKind,
  PaymentMethod,
  PaymentStatus,
  SupplierKind,
} from "@/generated/prisma/enums";

export { ApprovalStatus, Currency, DocumentType, ExpenseKind, PaymentMethod, PaymentStatus, SupplierKind };

export const CURRENCIES = Object.values(Currency) as Currency[];

export const CURRENCY_LABELS: Record<Currency, string> = {
  TRY: "TL",
  USD: "USD",
  EUR: "EUR",
  GBP: "GBP",
};

export const EXPENSE_KIND_LABELS: Record<ExpenseKind, string> = {
  EXPENSE: "Harcama",
  ADVANCE: "Avans (bağlantı / taşeron)",
};

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  INVOICE: "Fatura",
  DELIVERY_NOTE: "İrsaliye",
  RECEIPT: "Fiş",
  PROGRESS_BILLING: "Hakediş",
  VOUCHER: "Makbuz",
  NONE: "Belgesiz",
};

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  UNPAID: "Ödenmedi",
  PAID: "Ödendi",
};

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  CASH: "Nakit",
  BANK_TRANSFER: "Havale / EFT",
  CHEQUE: "Çek",
  PROMISSORY_NOTE: "Senet",
  CREDIT_CARD: "Kredi kartı",
};

export const APPROVAL_STATUS_LABELS: Record<ApprovalStatus, string> = {
  PENDING: "Onay bekliyor",
  APPROVED: "Onaylandı",
  REJECTED: "Reddedildi",
};

export const SUPPLIER_KIND_LABELS: Record<SupplierKind, string> = {
  SUPPLIER: "Tedarikçi",
  SUBCONTRACTOR: "Taşeron",
  BOTH: "Tedarikçi + taşeron",
};
