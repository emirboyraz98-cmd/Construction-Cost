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
    description: "Harcama girişi (mobil, tablo modu, Excel), onay ve ödeme durumu.",
  },
  {
    key: "contracts",
    label: "Taşeron & hakediş",
    capability: "contract.view",
    description: "Taşeron sözleşmeleri, birim fiyatlar, hakedişler ve kesintiler.",
  },
  {
    key: "budget",
    label: "Bütçe",
    capability: "budget.view",
    description: "Kalem kalem miktar × birim fiyat, toplam maliyet ve m² maliyetleri.",
  },
  {
    key: "control",
    label: "Bütçe kontrolü",
    capability: "budget.view",
    description: "Baz bütçe, gerçekleşen, ilerleme, tahmini tamamlanma maliyeti (EAC), sapma, bağlantı kapsaması ve kazancı.",
  },
  {
    key: "cost-tree",
    label: "Maliyet ağacı",
    capability: "costTree.view",
    description: "Projenin İKY (iş kırılım yapısı) ağacı.",
  },
  {
    key: "blocks",
    label: "Bloklar",
    description: "Bloklar: kat adedi, bodrum, inşaat alanı.",
  },
  {
    key: "units",
    label: "Bağımsız bölümler",
    description: "Kat kat bölümler, alanlar, sahiplik (müteahhit / arsa sahibi) ve alan kontrolleri.",
  },
  {
    key: "land",
    label: "Arsa & sözleşme",
    description: "Arsa modeli, arsa sahipleri, pay oranları ve kira yardımları.",
  },
  {
    key: "quantities",
    label: "Metraj",
    capability: "budget.view",
    description: "Parametrik katsayılar, formül değişkenleri ve gerçekleşen katsayılar.",
  },
  {
    key: "pricing",
    label: "Fiyatlandırma",
    capability: "priceList.view",
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
    capability: "expense.viewAll",
    description: "Ay, maliyet kalemi, tedarikçi ve blok bazında harcama raporları.",
  },
];

export const COMPANY_MODULES: readonly (ModuleDef & { href: string })[] = [
  { key: "portfolio", href: "/portfolio", label: "Portföy", description: "Tüm projelerin özeti." },
  { key: "projects", href: "/projects", label: "Projeler", description: "Tüm projelerin listesi." },
  {
    key: "connections",
    href: "/company/connections",
    label: "Bağlantılar",
    capability: "connection.view",
    description:
      "Malzeme bağlantıları: toplam / çekilen / kalan miktar, proje tahsisi, çekiş ve ödeme girişi, avans bakiyesi, uyarılar.",
  },
  {
    key: "transfers",
    href: "/company/transfers",
    label: "Malzeme transferi",
    capability: "transfer.create",
    description: "Bir şantiyede artan malzemenin başka projeye gönderilmesi; maliyeti de aktarılır.",
  },
  {
    key: "suppliers",
    href: "/company/suppliers",
    label: "Tedarikçiler",
    capability: "supplier.view",
    description: "Tedarikçi ve taşeronlar, cari özetleri.",
  },
  {
    key: "payables",
    href: "/company/payables",
    label: "Vade listesi",
    capability: "expense.viewAll",
    description: "Tüm projelerde ödenmemiş harcamalar; bu hafta ödenecekler.",
  },
  {
    key: "shared-invoice",
    href: "/company/shared-invoice",
    label: "Ortak fatura",
    capability: "expense.manage",
    description: "Birden fazla projeyi ilgilendiren faturayı projelere bölerek girme.",
  },
  {
    key: "accountant",
    href: "/company/accountant",
    label: "Muhasebeci paketi",
    capability: "accountant.export",
    description: "Dönemlik fatura listesi, tedarikçi özetleri ve belge görselleri (ZIP).",
  },
  {
    key: "library",
    href: "/company/library",
    label: "Kütüphane",
    capability: "library.view",
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
