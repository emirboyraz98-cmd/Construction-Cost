// Faz 3 ekranlarındaki Türkçe etiketler.
import type {
  BudgetPriceSource,
  Currency,
  CoefficientBasis,
  PriceSource,
  QuantitySource,
  ResourceType,
  UnitOwner,
  UsageType,
} from "@/generated/prisma/enums";
import { formatNumber } from "../format";

export const USAGE_TYPE_LABELS: Record<UsageType, string> = {
  RESIDENTIAL: "Konut",
  SHOP: "Dükkân",
  OFFICE: "Ofis",
  STORAGE: "Depo",
};

export const UNIT_OWNER_LABELS: Record<UnitOwner, string> = {
  CONTRACTOR: "Müteahhit",
  LANDOWNER: "Arsa sahibi",
};

export const RESOURCE_TYPE_LABELS: Record<ResourceType, string> = {
  MATERIAL: "Malzeme",
  LABOR: "İşçilik",
  EQUIPMENT: "Makine / ekipman",
  SERVICE: "Hizmet",
};

export const PRICE_SOURCE_LABELS: Record<PriceSource | "INVOICE" | "CONNECTION", string> = {
  CONNECTION: "Bağlantı fiyatı",
  INVOICE: "Son alım (fatura)",
  QUOTE: "Teklif",
  MARKET: "Piyasa araştırması",
};

export const QUANTITY_SOURCE_LABELS: Record<QuantitySource, string> = {
  PARAMETRIC: "Parametrik",
  FORMULA: "Formül",
  MANUAL: "Manuel",
};

export const BUDGET_PRICE_SOURCE_LABELS: Record<BudgetPriceSource, string> = {
  RECIPE: "Reçete",
  RESOURCE: "Kütüphane fiyatı",
  MANUAL: "Elle",
};

export const COEFFICIENT_BASIS_LABELS: Record<CoefficientBasis, string> = {
  CONSTRUCTION_AREA: "m² inşaat alanı",
  SELLABLE_GROSS: "m² satılabilir brüt",
  SELLABLE_NET: "m² satılabilir net",
  LAND_AREA: "m² arsa",
  UNIT_COUNT: "bağımsız bölüm",
};

/** "3.200 TL", "41,825 USD" (KDV hariç birim fiyat gösterimi). */
export const priceText = (price: string, currency: Currency) =>
  `${formatNumber(price, 4)} ${currency === "TRY" ? "TL" : currency}`;

export const FLOOR_LABEL = (floor: number) => (floor < 0 ? `${-floor}. bodrum` : floor === 0 ? "Zemin" : `${floor}. kat`);
