// Faz 2 ekranlarındaki Türkçe etiketler.
import type {
  ConnectionPriceType,
  ConnectionStatus,
  ContractStatus,
  ProgressBillingStatus,
  SupplyMethod,
} from "@/generated/prisma/enums";

export const CONNECTION_STATUS_LABELS: Record<ConnectionStatus, string> = {
  DRAFT: "Taslak",
  ACTIVE: "Aktif",
  COMPLETED: "Tamamlandı",
  CANCELLED: "İptal",
};

export const PRICE_TYPE_LABELS: Record<ConnectionPriceType, string> = {
  FIXED: "Sabit fiyat",
  FX_AT_DELIVERY: "Döviz bazlı – çekiş günü kuru",
  FX_AT_PAYMENT: "Döviz bazlı – ödeme günü kuru",
  FIXED_UNTIL: "Belli tarihe kadar sabit, sonrası güncel fiyat",
};

export const CONTRACT_STATUS_LABELS: Record<ContractStatus, string> = {
  ACTIVE: "Devam ediyor",
  COMPLETED: "Tamamlandı",
  CANCELLED: "İptal",
};

export const SUPPLY_METHOD_LABELS: Record<SupplyMethod, string> = {
  TURNKEY: "Malzemeli taşeron (anahtar teslim)",
  LABOR_ONLY: "Malzeme bizden + taşeron işçilik",
};

export const BILLING_STATUS_LABELS: Record<ProgressBillingStatus, string> = {
  DRAFT: "Taslak",
  PENDING: "Onay bekliyor",
  APPROVED: "Onaylandı",
};
