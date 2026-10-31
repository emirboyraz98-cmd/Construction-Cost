// Değişiklik geçmişi ekranı için kayıt ve işlem adları (Türkçe).

export const ENTITY_LABELS: Record<string, string> = {
  Expense: "Harcama",
  ProgressBilling: "Hakediş",
  Unit: "Bağımsız bölüm",
  User: "Kullanıcı",
  SaleContract: "Satış sözleşmesi",
  ConnectionPayment: "Bağlantı ödemesi",
  Connection: "Bağlantı",
  Supplier: "Tedarikçi",
  SubcontractContract: "Taşeron sözleşmesi",
  Parameter: "Parametre",
  Customer: "Müşteri",
  ConnectionAllocation: "Bağlantı tahsisi",
  Collection: "Tahsilat",
  BudgetLine: "Bütçe satırı",
  Block: "Blok",
  ScheduleEntry: "İş programı",
  Scenario: "Senaryo",
  ResourcePrice: "Malzeme fiyatı",
  Reservation: "Rezervasyon",
  Project: "Proje",
  PricingFactor: "Fiyat katsayısı",
  ParametricCoefficient: "Metraj katsayısı",
  MaterialTransfer: "Malzeme transferi",
  Landowner: "Arsa sahibi",
  ExchangeRate: "Döviz kuru",
  CostItem: "Maliyet kalemi",
  ConnectionInvoice: "Bağlantı faturası",
  BudgetBaseline: "Baz bütçe",
  Resource: "Malzeme",
  Recipe: "Reçete",
  PricingSetting: "Fiyatlandırma ayarı",
  PriceList: "Fiyat listesi",
  CostItemProgress: "Tamamlanma yüzdesi",
  CompanyCashSetting: "Şirket nakit ayarı",
  CashFlowSetting: "Nakit akışı ayarı",
  AccountantPackage: "Muhasebeci paketi",
};

export const ACTION_LABELS: Record<string, string> = {
  create: "Ekledi",
  update: "Değiştirdi",
  delete: "Sildi",
  approve: "Onayladı",
  reject: "Reddetti",
  submit: "Onaya gönderdi",
  revert: "Onayı geri aldı",
  cancel: "İptal etti",
  status: "Durumunu değiştirdi",
  import: "İçe aktardı",
  export: "İndirdi",
  login: "Giriş yaptı",
  login_locked: "Hatalı şifre nedeniyle kilitlendi",
  activate: "Etkinleştirdi",
  deactivate: "Pasifleştirdi",
  allocate: "Tahsis etti",
  auto_allocate: "Havuzdan tahsis etti",
  draw: "Çekiş girdi",
  lock: "Fiyatı kilitledi",
  unlock: "Fiyat kilidini açtı",
  vat: "KDV oranını değiştirdi",
  factors: "Katsayıları değiştirdi",
  copy: "Kopyaladı",
  generate: "Toplu oluşturdu",
  set_owner: "Sahipliği değiştirdi",
  match_resource: "Malzemeyle eşleştirdi",
  plan: "Ödeme planını değiştirdi",
  cheque: "Çek durumunu değiştirdi",
  handover: "Teslim tarihini girdi",
  progress: "Tamamlanma girdi",
  schedule: "İş programını değiştirdi",
  defaultSchedule: "Varsayılan iş programını uyguladı",
};

export const entityLabel = (e: string) => ENTITY_LABELS[e] ?? e;
export const actionLabel = (a: string) => ACTION_LABELS[a] ?? a;

/** Değişiklik özeti: { alan: { old, new } } biçiminde ise "alan: eski → yeni", değilse kısa metin. */
export function changesText(changes: unknown): string {
  if (changes == null) return "";
  if (Array.isArray(changes)) return `${changes.length} satır`;
  if (typeof changes !== "object") return String(changes);
  return Object.entries(changes as Record<string, unknown>)
    .slice(0, 6)
    .map(([k, v]) => {
      if (v && typeof v === "object" && "old" in v && "new" in v) {
        const d = v as { old: unknown; new: unknown };
        return `${k}: ${d.old ?? "—"} → ${d.new ?? "—"}`;
      }
      return `${k}: ${typeof v === "object" ? JSON.stringify(v) : String(v)}`;
    })
    .join(" · ");
}
