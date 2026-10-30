// Ekranda gösterilen Türkçe etiketler (veritabanı değerleri İngilizce).
import { LandModel, ProjectStatus, ProjectType } from "@/generated/prisma/enums";

export { LandModel, ProjectStatus, ProjectType };

export const PROJECT_TYPE_LABELS: Record<ProjectType, string> = {
  RESIDENTIAL: "Konut (apartman)",
  VILLA: "Villa / müstakil",
  COMMERCIAL: "Ticari (dükkân / ofis)",
  MIXED: "Karma (konut + ticari)",
  SITE: "Çok bloklu site",
};

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  FEASIBILITY: "Fizibilite",
  PERMIT: "Ruhsat",
  CONSTRUCTION: "İnşaat",
  SALES: "Satış",
  COMPLETED: "Tamamlandı",
  ARCHIVED: "Arşiv",
};

/** Proje durumlarının iş akışındaki sırası. */
export const PROJECT_STATUS_ORDER = Object.values(ProjectStatus) as ProjectStatus[];

export const LAND_MODEL_LABELS: Record<LandModel, string> = {
  FLAT_FOR_LAND: "Kat karşılığı",
  PURCHASE: "Arsa satın alma",
  MIXED: "Karma",
};

export const LAND_MODEL_DESCRIPTIONS: Record<LandModel, string> = {
  FLAT_FOR_LAND:
    "Arsa sahiplerine sözleşmedeki oranda bağımsız bölüm verilir; kira yardımları ve arsa sahibi payı izlenir.",
  PURCHASE: "Arsa bedeli ödenerek satın alınır; ödeme planı ve tapu masrafları izlenir.",
  MIXED: "Kat karşılığına ek olarak arsa sahibine nakit / şerefiye ödenir.",
};
