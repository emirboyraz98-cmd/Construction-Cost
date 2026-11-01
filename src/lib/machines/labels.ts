import type { MachineEntryType, MachineStatus, MachineUsageUnit } from "@/generated/prisma/enums";

export const MACHINE_STATUS_LABELS: Record<MachineStatus, string> = {
  ACTIVE: "Aktif",
  SOLD: "Satıldı",
  SCRAPPED: "Hurdaya ayrıldı",
};

export const MACHINE_UNIT_LABELS: Record<MachineUsageUnit, string> = { HOUR: "saat", DAY: "gün" };

/** Sırası formdaki sıradır: önce giderler, sonra gelirler. */
export const MACHINE_ENTRY_TYPE_LABELS: Record<MachineEntryType, string> = {
  PURCHASE: "Satın alma",
  FINANCING: "Kredi / leasing taksiti",
  FUEL: "Yakıt",
  MAINTENANCE: "Periyodik bakım",
  REPAIR: "Onarım / yedek parça",
  INSURANCE: "Sigorta / kasko",
  TAX: "Vergi / muayene / harç",
  OPERATOR: "Operatör ücreti",
  TRANSPORT: "Nakliye (lowbed)",
  OTHER_COST: "Diğer gider",
  RENT_INCOME: "Kira geliri (dışarıya)",
  SALE: "Makine satışı",
  OTHER_INCOME: "Diğer gelir",
};
