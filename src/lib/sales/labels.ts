// Satış ve tahsilat etiketleri.
import type { ChequeStatus, InstallmentKind } from "@/generated/prisma/enums";
import type { InstallmentState, UnitSaleStatus } from "./sales";

export const SALE_STATUS_LABELS: Record<UnitSaleStatus, string> = {
  AVAILABLE: "Boş",
  RESERVED: "Rezerve",
  SOLD: "Satıldı",
  LANDOWNER: "Arsa sahibi",
};

export const SALE_STATUS_STYLES: Record<UnitSaleStatus, string> = {
  AVAILABLE: "border-slate-300 bg-white text-slate-700",
  RESERVED: "border-amber-300 bg-amber-50 text-amber-800",
  SOLD: "border-emerald-300 bg-emerald-50 text-emerald-800",
  LANDOWNER: "border-violet-300 bg-violet-50 text-violet-800",
};

export const INSTALLMENT_KIND_LABELS: Record<InstallmentKind, string> = {
  DOWN_PAYMENT: "Peşinat",
  INSTALLMENT: "Taksit",
  INTERIM: "Ara ödeme",
  KEY_DELIVERY: "Anahtar teslim",
  BANK_LOAN: "Banka kredisi",
};

export const INSTALLMENT_STATE_LABELS: Record<InstallmentState, string> = {
  PAID: "Ödendi",
  PAPER: "Çek / senette",
  PARTIAL: "Kısmi",
  OVERDUE: "Gecikti",
  DUE_SOON: "Yaklaşıyor",
  UPCOMING: "Bekliyor",
};

export const INSTALLMENT_STATE_STYLES: Record<InstallmentState, string> = {
  PAID: "border-emerald-300 bg-emerald-50 text-emerald-800",
  PAPER: "border-teal-300 bg-teal-50 text-teal-800",
  PARTIAL: "border-sky-300 bg-sky-50 text-sky-800",
  OVERDUE: "border-red-300 bg-red-50 text-red-700",
  DUE_SOON: "border-amber-300 bg-amber-50 text-amber-800",
  UPCOMING: "border-slate-300 bg-white text-slate-700",
};

export const CHEQUE_STATUS_LABELS: Record<ChequeStatus, string> = {
  PENDING: "Portföyde",
  CLEARED: "Tahsil edildi",
  BOUNCED: "Karşılıksız",
};
