// Sol menüdeki modüller (PLAN.md Bölüm 11 ve 14). Henüz yapılmayanlar "Yakında"
// olarak gösterilir ve hangi fazda geleceği yazılır.
import type { Capability } from "./auth/roles";

export type ModuleDef = {
  key: string;
  label: string;
  description: string;
  /** Yapılmadıysa geleceği faz (PLAN.md Bölüm 14) */
  phase?: number;
  capability?: Capability;
};

export const PROJECT_MODULES: readonly ModuleDef[] = [
  {
    key: "",
    label: "Proje paneli",
    description: "Projenin özet bilgileri, blokları ve durumu.",
  },
  {
    key: "expenses",
    label: "Harcamalar",
    phase: 1,
    description:
      "Mobil hızlı giriş (fiş/fatura fotoğrafı), ofis tablo modu, onay akışı, Excel'den fatura aktarımı, vade listesi ve muhasebeci Excel paketi.",
  },
  {
    key: "cost-tree",
    label: "Bütçe / Maliyet ağacı",
    capability: "costTree.view",
    description: "Projenin İKY (iş kırılım yapısı) ağacı.",
  },
  {
    key: "blocks",
    label: "Bloklar & bölümler",
    description: "Bloklar; bağımsız bölümler Faz 3'te eklenecek.",
  },
  {
    key: "land",
    label: "Arsa & sözleşme",
    phase: 3,
    description: "Arsa sahipleri, paylar, kira yardımları, satın alma ödeme planı.",
  },
  {
    key: "quantities",
    label: "Metraj",
    phase: 3,
    description: "Parametrik katsayılar, formül girdileri, manuel veya Excel'den metraj.",
  },
  {
    key: "pricing",
    label: "Fiyatlandırma",
    phase: 5,
    description:
      "Kâr yöntemi, reklam ve komisyon payı, katsayı tabloları → bağımsız bölüm fiyat listesi (KDV hariç/dahil).",
  },
  {
    key: "sales",
    label: "Satışlar",
    phase: 6,
    description: "Bölüm durumu, rezervasyon, satış sözleşmesi, ödeme planı.",
  },
  {
    key: "collections",
    label: "Tahsilatlar",
    phase: 6,
    description: "Taksit takvimi, geciken taksitler, tahsilat girişi.",
  },
  {
    key: "cash-flow",
    label: "Nakit akışı",
    phase: 7,
    description: "Aylık harcama, tahsilat ve bağlantı ödemeleri; iş programı.",
  },
  {
    key: "scenarios",
    label: "Senaryolar",
    phase: 7,
    description: "İyimser / baz / kötümser senaryolar ve duyarlılık analizi.",
  },
  {
    key: "reports",
    label: "Raporlar",
    phase: 1,
    description:
      "PDF/Excel raporlar: harcama (Faz 1), bütçe ve sapma, fiyat listesi, satış/tahsilat, fizibilite.",
  },
];

export const COMPANY_MODULES: readonly (ModuleDef & { href: string })[] = [
  { key: "portfolio", href: "/portfolio", label: "Portföy", description: "Tüm projelerin özeti." },
  { key: "projects", href: "/projects", label: "Projeler", description: "Tüm projelerin listesi." },
  {
    key: "connections",
    href: "/company/connections",
    label: "Bağlantılar",
    phase: 2,
    description:
      "Malzeme bağlantıları: toplam / çekilen / kalan miktar, proje tahsisi, çekiş ve ödeme girişi, avans bakiyesi, uyarılar.",
  },
  {
    key: "suppliers",
    href: "/company/suppliers",
    label: "Tedarikçiler",
    phase: 1,
    description:
      "Tedarikçi ve taşeronlar: iletişim, teklifler, sözleşmeler, hakedişler, cari hesap ve vade listesi.",
  },
  {
    key: "library",
    href: "/company/library",
    label: "Kütüphane",
    phase: 3,
    description: "Malzeme, işçilik ve makine kütüphanesi; fiyat geçmişi, bağlantı fiyatları, reçeteler.",
  },
  {
    key: "reports",
    href: "/company/reports",
    label: "Projeler arası raporlar",
    phase: 7,
    description: "Projeler arası karşılaştırma (m² maliyet, birim fiyatlar, kâr), konsolide harcama ve nakit.",
  },
  { key: "settings", href: "/settings", label: "Ayarlar", description: "Kullanıcılar ve ayarlar." },
];

export function projectModuleHref(projectId: string, key: string): string {
  return key ? `/projects/${projectId}/${key}` : `/projects/${projectId}`;
}
