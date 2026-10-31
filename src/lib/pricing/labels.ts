// Fiyatlandırma etiketleri (arayüz ve çıktılar).
import type { PricingCostBasis, PricingFactorKind, ProfitMethod } from "@/generated/prisma/enums";

export const PROFIT_METHOD_LABELS: Record<ProfitMethod, string> = {
  MARGIN: "Satış üzerinden marj",
  MARKUP: "Maliyet üzerine ekleme",
};

export const COST_BASIS_LABELS: Record<PricingCostBasis, string> = {
  BUDGET: "Güncel bütçe",
  EAC: "Tahmini tamamlanma maliyeti (EAC)",
  MANUAL: "Elle girilen maliyet",
};

export const FACTOR_KIND_LABELS: Record<PricingFactorKind, string> = {
  USAGE: "Kullanım tipi oranı",
  FLOOR: "Kat katsayısı",
  FACADE: "Cephe katsayısı",
  VIEW: "Manzara katsayısı",
  LAYOUT: "Tip katsayısı",
};

export const FACTOR_KIND_HINTS: Record<PricingFactorKind, string> = {
  USAGE: "Konut 1,00 kabul edilir; ör. dükkân 1,80 = konutun 1,8 katı m² fiyatı.",
  FLOOR: "Bölümlerdeki kat numaraları. Boş = 1,00.",
  FACADE: "Bölümlerde girilen cephe değerleri (K, G, D, B …).",
  VIEW: "Bölümlerde girilen manzara değerleri.",
  LAYOUT: "Bölümlerde girilen tip değerleri (1+1, 2+1 …).",
};
