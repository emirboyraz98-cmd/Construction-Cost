// Sol menüdeki modüller ve bölümler. Henüz yapılmayanlar "Yakında" olarak gösterilir.
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
    capability: "sales.view",
    description: "Bölüm durumu, müşteriler, rezervasyon, satış sözleşmesi, ödeme planı, teslim.",
  },
  {
    key: "collections",
    label: "Tahsilatlar",
    capability: "sales.view",
    description: "Taksit takvimi, geciken taksitler, tahsilat girişi.",
  },
  {
    key: "cash-flow",
    label: "Nakit akışı",
    capability: "cashflow.view",
    description: "Aylık harcama, hakediş, bağlantı ödemeleri, tahsilat ve satış varsayımı; iş programı, finansman maliyeti.",
  },
  {
    key: "scenarios",
    label: "Senaryolar",
    capability: "cashflow.view",
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
    key: "machines",
    href: "/company/machines",
    label: "Makineler",
    capability: "machine.view",
    description: "İş makinelerinin nakit hareketleri, projelerde çalışması (puantaj) ve kümülatif nakit akışı.",
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
    key: "cash",
    href: "/company/cash-flow",
    label: "Konsolide nakit",
    capability: "companyCash.view",
    description: "Tüm projelerin nakit akışı, atanmamış bağlantı ödemeleri ve genel merkez giderleri.",
  },
  {
    key: "reports",
    href: "/company/reports",
    label: "Projeler arası raporlar",
    capability: "cashflow.view",
    description: "Projeler arası karşılaştırma (m² maliyet, birim fiyatlar, kâr), konsolide harcama ve nakit.",
  },
  { key: "settings", href: "/settings", label: "Ayarlar", description: "Kullanıcılar ve ayarlar." },
];

/**
 * Sadeleştirilmiş menü: proje 6, şirket 5 bölüm. Her bölümün alt ekranları sayfanın üstünde
 * sekme olarak çıkar. `advanced` sekmeler basit görünümde gizlenir (adresle yine açılır).
 */
export type SectionTab = { key: string; label: string; advanced?: boolean };
export type NavSection = { id: string; label: string; description: string; tabs: readonly SectionTab[] };

export const PROJECT_SECTIONS: readonly NavSection[] = [
  { id: "panel", label: "Proje paneli", description: "Projenin özeti ve sıradaki işler.", tabs: [{ key: "", label: "Proje paneli" }] },
  {
    id: "expenses",
    label: "Harcamalar",
    description: "Harcama girişi, onay, taşeron ve hakediş.",
    tabs: [
      { key: "expenses", label: "Harcamalar" },
      { key: "contracts", label: "Taşeron & hakediş" },
    ],
  },
  {
    id: "building",
    label: "Bina ve arsa",
    description: "Bloklar, bağımsız bölümler, arsa sahipleri.",
    tabs: [
      { key: "blocks", label: "Bloklar" },
      { key: "units", label: "Bağımsız bölümler" },
      { key: "land", label: "Arsa & sözleşme" },
    ],
  },
  {
    id: "budget",
    label: "Bütçe",
    description: "Metraj, bütçe, bütçe kontrolü.",
    tabs: [
      { key: "budget", label: "Bütçe" },
      { key: "quantities", label: "Metraj" },
      { key: "control", label: "Bütçe kontrolü" },
      { key: "cost-tree", label: "Maliyet ağacı", advanced: true },
    ],
  },
  {
    id: "sales",
    label: "Satış",
    description: "Fiyat listesi, satışlar, tahsilatlar.",
    tabs: [
      { key: "sales", label: "Satışlar" },
      { key: "collections", label: "Tahsilatlar" },
      { key: "pricing", label: "Fiyatlandırma" },
    ],
  },
  {
    id: "money",
    label: "Nakit ve rapor",
    description: "Nakit akışı, raporlar, senaryolar.",
    tabs: [
      { key: "cash-flow", label: "Nakit akışı" },
      { key: "reports", label: "Raporlar" },
      { key: "scenarios", label: "Senaryolar", advanced: true },
    ],
  },
];

export const COMPANY_SECTIONS: readonly NavSection[] = [
  {
    id: "portfolio",
    label: "Portföy",
    description: "Tüm projelerin özeti.",
    tabs: [
      { key: "portfolio", label: "Portföy" },
      { key: "projects", label: "Projeler" },
    ],
  },
  {
    id: "purchasing",
    label: "Satın alma",
    description: "Bağlantılar, tedarikçiler, fiyat kütüphanesi.",
    tabs: [
      { key: "connections", label: "Bağlantılar" },
      { key: "suppliers", label: "Tedarikçiler" },
      { key: "library", label: "Kütüphane", advanced: true },
      { key: "transfers", label: "Malzeme transferi", advanced: true },
    ],
  },
  {
    id: "machines",
    label: "Makineler",
    description: "İş makineleri ve kümülatif nakit akışı.",
    tabs: [{ key: "machines", label: "Makineler" }],
  },
  {
    id: "payments",
    label: "Ödemeler",
    description: "Vade listesi, muhasebeci paketi.",
    tabs: [
      { key: "payables", label: "Vade listesi" },
      { key: "accountant", label: "Muhasebeci paketi" },
      { key: "shared-invoice", label: "Ortak fatura", advanced: true },
    ],
  },
  {
    id: "reports",
    label: "Şirket raporları",
    description: "Projeler arası karşılaştırma ve toplam nakit.",
    tabs: [
      { key: "reports", label: "Projeler arası" },
      { key: "cash", label: "Konsolide nakit" },
    ],
  },
  { id: "settings", label: "Ayarlar", description: "Kullanıcılar ve ayarlar.", tabs: [{ key: "settings", label: "Ayarlar" }] },
];

/** Bölümün kullanıcıya görünen sekmeleri (yetki ve görünüm kipine göre; açık olan sekme her zaman kalır). */
export function visibleTabs<T extends SectionTab>(
  section: { tabs: readonly T[] },
  canSee: (key: string) => boolean,
  advanced: boolean,
  activeKey?: string | null,
): T[] {
  return section.tabs.filter((t) => canSee(t.key) && (advanced || !t.advanced || t.key === activeKey));
}

/** Proje adresindeki ilk bölüm ("" = panel). */
export function projectSegment(pathname: string): { projectId: string; key: string } | null {
  const m = pathname.match(/^\/projects\/([^/]+)(?:\/([^/]+))?/);
  if (!m || m[1] === "new") return null;
  return { projectId: m[1], key: m[2] ?? "" };
}

/** Şirket geneli adresine karşılık gelen modül anahtarı. */
export function companyKey(pathname: string): string | null {
  if (pathname === "/projects") return "projects";
  const mod = COMPANY_MODULES.filter((m) => m.href !== "/projects").find((m) => pathname === m.href || pathname.startsWith(m.href + "/"));
  return mod?.key ?? null;
}

export function projectModuleHref(projectId: string, key: string): string {
  return key ? `/projects/${projectId}/${key}` : `/projects/${projectId}`;
}
