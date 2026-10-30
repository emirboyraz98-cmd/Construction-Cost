// Varsayılan İKY (iş kırılım yapısı) şablonu — PLAN.md Bölüm 3.
// Üst kalem, koddan türetilir (ör. "05.04.01" → "05.04").
// Birimler başlangıç önerisidir; PLAN'da birimi belirtilmeyen kalemler "götürü" gelir.

export type TemplateItem = {
  code: string;
  name: string;
  unit?: string;
  description?: string;
};

export const DEFAULT_COST_TEMPLATE: readonly TemplateItem[] = [
  { code: "01", name: "Arsa ve Kat Karşılığı" },
  {
    code: "01.01",
    name: "Arsa bedeli veya kat karşılığı payı",
    unit: "götürü",
    description: "Satın almada arsa bedeli; kat karşılığında arsa sahibine düşen pay (oran)",
  },
  {
    code: "01.02",
    name: "Arsa sahibine ödenen ek nakit / şerefiye",
    unit: "götürü",
    description: "Karma model",
  },
  {
    code: "01.03",
    name: "Arsa sahiplerine kira yardımı",
    unit: "ay",
    description: "Aylık × kişi × inşaat süresi",
  },
  { code: "01.04", name: "Taşınma yardımı", unit: "götürü" },
  {
    code: "01.05",
    name: "Noter – düzenleme şeklinde kat karşılığı sözleşmesi masrafları",
    unit: "götürü",
  },
  {
    code: "01.06",
    name: "Tapu harçları, döner sermaye, kat irtifakı / kat mülkiyeti tesisi",
    unit: "götürü",
  },
  {
    code: "01.07",
    name: "Mevcut yapının yıkımı, hurda/moloz bedeli, yıkım ruhsatı",
    unit: "götürü",
  },
  { code: "01.08", name: "Danışmanlık, avukat, emlak komisyonu (arsa için)", unit: "götürü" },
  {
    code: "01.09",
    name: "Arsa sahiplerine verilen dairelerin ek talepleri",
    unit: "götürü",
    description: "Yükseltilmiş malzeme vb.",
  },

  { code: "02", name: "Ruhsat, Proje ve Resmî İşlemler" },
  {
    code: "02.01",
    name: "İmar durumu, çap, aplikasyon, röperli kroki, harita mühendisliği",
    unit: "götürü",
  },
  {
    code: "02.02",
    name: "Zemin etüdü",
    unit: "götürü",
    description: "Sondaj, laboratuvar, rapor",
  },
  {
    code: "02.03",
    name: "Projeler",
    unit: "götürü",
    description:
      "Mimari, statik, mekanik, elektrik, peyzaj, altyapı, iksa, yangın, enerji kimlik belgesi, ısı yalıtım",
  },
  { code: "02.04", name: "Proje onay ve belediye harçları", unit: "götürü" },
  { code: "02.05", name: "Yapı ruhsatı harcı", unit: "götürü" },
  {
    code: "02.06",
    name: "Otopark bedeli",
    unit: "götürü",
    description: "Eksik otopark varsa",
  },
  { code: "02.07", name: "Yapı denetim" },
  {
    code: "02.07.01",
    name: "Yapı denetim hizmet bedeli",
    unit: "götürü",
    description:
      "Yapı sınıfı ve inşaat alanına göre hesaplanır; ödemeler iş ilerledikçe kademeli yapılır " +
      "(ödeme planı olarak tutulur, her kademe ödendikçe işaretlenir)",
  },
  {
    code: "02.07.02",
    name: "Laboratuvar deney ücretleri",
    unit: "götürü",
    description:
      "Beton numune alma ve kırma (her dökümde), inşaat demiri çekme/eğme deneyleri, " +
      "gerekirse karot ve ek deneyler",
  },
  {
    code: "02.07.03",
    name: "Ek kontrol, tekrar deney ve diğer yapı denetim kaynaklı masraflar",
    unit: "götürü",
  },
  { code: "02.08", name: "SGK – asgari işçilik / ilişiksizlik", unit: "götürü" },
  {
    code: "02.09",
    name: "Altyapı katılım payları",
    unit: "götürü",
    description: "Su, kanal, elektrik, doğalgaz",
  },
  { code: "02.10", name: "Şantiye şefi / fenni mesul ücretleri", unit: "götürü" },
  {
    code: "02.11",
    name: "İskân (yapı kullanma izin) harçları, itfaiye raporu, asansör tescil",
    unit: "götürü",
  },
  {
    code: "02.12",
    name: "Abonelikler",
    unit: "götürü",
    description: "Kalıcı elektrik, su, doğalgaz",
  },
  {
    code: "02.13",
    name: "Sigortalar",
    unit: "götürü",
    description: "İnşaat all-risk, işveren sorumluluk, DASK",
  },
  {
    code: "02.14",
    name: "İSG",
    unit: "götürü",
    description: "Risk değerlendirme, iş güvenliği uzmanı, ekipman",
  },

  { code: "03", name: "Şantiye Kurulumu ve Genel Giderler" },
  {
    code: "03.01",
    name: "Şantiye çiti, konteyner, WC, depo, şantiye elektrik/su bağlantısı",
    unit: "götürü",
  },
  {
    code: "03.02",
    name: "Kule vinç / mobil vinç",
    unit: "ay",
    description: "Kira, kurulum, operatör",
  },
  {
    code: "03.03",
    name: "İskele, güvenlik ağı",
    unit: "m²",
    description: "Kira veya alım",
  },
  {
    code: "03.04",
    name: "Şantiye personeli",
    unit: "ay",
    description: "Şef, mühendis, tekniker, bekçi, puantör",
  },
  { code: "03.05", name: "Şantiye elektrik, su, yakıt, iletişim giderleri", unit: "ay" },
  { code: "03.06", name: "Küçük alet-edevat, sarf malzeme", unit: "götürü" },
  { code: "03.07", name: "Şantiye temizliği, moloz atımı", unit: "götürü" },
  { code: "03.08", name: "Genel merkez gider payı", unit: "%" },

  { code: "04", name: "Hafriyat ve Zemin" },
  { code: "04.01", name: "Kazı, nakliye, döküm sahası bedeli", unit: "m³" },
  {
    code: "04.02",
    name: "İksa",
    unit: "götürü",
    description: "Fore kazık, ankraj, püskürtme beton",
  },
  {
    code: "04.03",
    name: "Zemin iyileştirme",
    unit: "götürü",
    description: "Jet-grout vb.",
  },
  { code: "04.04", name: "Dolgu, sıkıştırma, drenaj", unit: "m³" },
  { code: "04.05", name: "Su çekme", unit: "götürü", description: "Gerekirse" },

  { code: "05", name: "Temel ve Betonarme (Kaba İnşaat)" },
  { code: "05.01", name: "Grobeton", unit: "m³" },
  { code: "05.02", name: "Temel altı / perde su yalıtımı, koruma betonu", unit: "m²" },
  { code: "05.03", name: "Radye / sürekli temel betonu", unit: "m³" },
  {
    code: "05.04",
    name: "Beton",
    description:
      "Beton deneyleri 02.07.02 altında izlenir; her döküm kaydı (tarih, kat/eleman, m³, " +
      "beton sınıfı, irsaliye) ilgili deney ve pompa giderleriyle ilişkilendirilebilir",
  },
  {
    code: "05.04.01",
    name: "Hazır beton",
    unit: "m³",
    description: "Sınıf bazında: C25, C30, C35 …",
  },
  {
    code: "05.04.02",
    name: "Beton pompası, mikser bekleme ücreti",
    unit: "m³",
    description: "m³ veya sefer bazlı",
  },
  {
    code: "05.04.03",
    name: "Beton katkıları",
    unit: "götürü",
    description: "Su geçirimsizlik, antifriz, priz geciktirici",
  },
  { code: "05.04.04", name: "Gece / hafta sonu döküm farkı", unit: "götürü" },
  { code: "05.04.05", name: "Döküm işçiliği, vibratör, perdah", unit: "m³" },
  {
    code: "05.04.06",
    name: "Kür",
    unit: "götürü",
    description: "Sulama, kür örtüsü/kimyasalı; kış şartlarında örtü ve ısıtma",
  },
  {
    code: "05.05",
    name: "İnşaat demiri, kesme-bükme işçiliği",
    unit: "ton",
    description: "Çap bazında",
  },
  {
    code: "05.06",
    name: "Kalıp",
    unit: "m²",
    description: "Temel, perde, kolon, kiriş, döşeme; kalıp malzemesi/kira",
  },
  {
    code: "05.07",
    name: "Betonarme işçiliği",
    unit: "m²",
    description: "m² veya m³ bazlı taşeron",
  },
  { code: "05.08", name: "Merdivenler, asansör kuyusu", unit: "götürü" },
  { code: "05.09", name: "Topraklama (temel topraklaması)", unit: "götürü" },

  { code: "06", name: "Duvarlar ve Çatı" },
  {
    code: "06.01",
    name: "Dış duvar, harç",
    unit: "m²",
    description: "Bims / tuğla / gazbeton",
  },
  { code: "06.02", name: "İç bölme duvarlar", unit: "m²" },
  { code: "06.03", name: "Lento, hatıl", unit: "mt" },
  {
    code: "06.04",
    name: "Çatı",
    unit: "m²",
    description: "Ahşap/çelik konstrüksiyon, OSB, su yalıtımı, kiremit/panel, oluk-iniş borusu",
  },
  {
    code: "06.05",
    name: "Teras çatı",
    unit: "m²",
    description: "Eğim betonu, ısı + su yalıtımı, koruma",
  },

  { code: "07", name: "Cephe" },
  {
    code: "07.01",
    name: "Mantolama",
    unit: "m²",
    description: "Isı yalıtım levhası, yapıştırıcı, dübel, file, sıva, boya",
  },
  {
    code: "07.02",
    name: "Dış cephe kaplama",
    unit: "m²",
    description: "Kompozit, taş, seramik vb.",
  },
  { code: "07.03", name: "Cephe iskelesi", unit: "m²", description: "03.03 ile ilişkili" },
  { code: "07.04", name: "Denizlikler, parapetler", unit: "mt" },
  {
    code: "07.05",
    name: "Dükkân vitrin camları, kepenk",
    unit: "m²",
    description: "Ticari bölümler",
  },

  { code: "08", name: "İnce İşler" },
  {
    code: "08.01",
    name: "İç sıva",
    unit: "m²",
    description: "Kaba + ince / makine alçı sıvası",
  },
  { code: "08.02", name: "Saten alçı, köşe profili", unit: "m²" },
  { code: "08.03", name: "Şap", unit: "m²", description: "m², kalınlık" },
  { code: "08.04", name: "Islak hacim su yalıtımı", unit: "m²" },
  {
    code: "08.05",
    name: "Seramik / granit, yapıştırıcı, derz",
    unit: "m²",
    description: "Zemin + duvar",
  },
  { code: "08.06", name: "Laminat / parke, süpürgelik", unit: "m²" },
  { code: "08.07", name: "Asma tavan (alçıpan), kartonpiyer", unit: "m²" },
  { code: "08.08", name: "İç boya", unit: "m²", description: "Astar + son kat" },
  {
    code: "08.09",
    name: "Pencere doğramaları, cam, pervaz",
    unit: "m²",
    description: "PVC / alüminyum",
  },
  { code: "08.10", name: "Balkon korkulukları, küpeşte", unit: "mt" },
  { code: "08.11", name: "Çelik kapı, iç kapılar, kapı kolları", unit: "adet" },
  { code: "08.12", name: "Mutfak dolapları, tezgâh", unit: "mt" },
  {
    code: "08.13",
    name: "Banyo",
    unit: "takım",
    description: "Vitrifiye, batarya, duşakabin, lavabo dolabı, ayna",
  },
  { code: "08.14", name: "Ankastre set", unit: "takım", description: "Verilecekse" },
  { code: "08.15", name: "Vestiyer, gömme dolap", unit: "adet" },
  { code: "08.16", name: "Merdiven kaplaması, korkuluklar", unit: "götürü" },

  { code: "09", name: "Mekanik Tesisat" },
  {
    code: "09.01",
    name: "Temiz su tesisatı, su deposu, hidrofor",
    unit: "götürü",
    description: "Boru, fittings, kollektör",
  },
  { code: "09.02", name: "Pis su tesisatı, yağmur suyu", unit: "götürü" },
  { code: "09.03", name: "Doğalgaz tesisatı, kombi / merkezi sistem", unit: "götürü" },
  {
    code: "09.04",
    name: "Isıtma",
    unit: "götürü",
    description: "Radyatör veya yerden ısıtma",
  },
  { code: "09.05", name: "Havalandırma, aspiratör", unit: "götürü" },
  {
    code: "09.06",
    name: "Yangın tesisatı",
    unit: "götürü",
    description: "Sprinkler, dolap, tüp",
  },
  { code: "09.07", name: "Klima altyapısı", unit: "götürü", description: "Verilecekse" },

  { code: "10", name: "Elektrik ve Zayıf Akım" },
  {
    code: "10.01",
    name: "Kablo, buat, boru, anahtar-priz, sigorta panoları",
    unit: "götürü",
  },
  {
    code: "10.02",
    name: "Aydınlatma armatürleri",
    unit: "götürü",
    description: "Ortak alan + daire",
  },
  { code: "10.03", name: "Topraklama, paratoner", unit: "götürü" },
  {
    code: "10.04",
    name: "Diyafon / görüntülü diyafon, uydu, internet altyapısı",
    unit: "götürü",
  },
  { code: "10.05", name: "Yangın algılama, kamera, kartlı geçiş", unit: "götürü" },
  { code: "10.06", name: "Jeneratör, trafo payı", unit: "götürü", description: "Varsa" },

  { code: "11", name: "Asansör" },
  {
    code: "11.01",
    name: "Asansör(ler)",
    unit: "adet",
    description: "Makine, kabin, ray, kapılar, montaj, ilk tescil",
  },

  { code: "12", name: "Ortak Alanlar, Peyzaj ve Çevre Düzeni" },
  {
    code: "12.01",
    name: "Giriş holü, merdiven holleri kaplama ve aydınlatma",
    unit: "götürü",
  },
  {
    code: "12.02",
    name: "Otopark",
    unit: "m²",
    description: "Epoksi zemin, çizgi, havalandırma",
  },
  {
    code: "12.03",
    name: "Peyzaj",
    unit: "götürü",
    description: "Bitkilendirme, sulama, bahçe duvarı",
  },
  { code: "12.04", name: "Bahçe kapısı, sınır duvarı, korkuluk", unit: "götürü" },
  {
    code: "12.05",
    name: "Sosyal alanlar",
    unit: "götürü",
    description: "Havuz, spor salonu, çocuk parkı (site projelerinde)",
  },
  { code: "12.06", name: "Çöp odası, sığınak", unit: "götürü" },
  {
    code: "12.07",
    name: "Site altyapısı",
    unit: "götürü",
    description: "İç yollar, güvenlik kulübesi, çevre aydınlatması (çok bloklu projeler)",
  },
  {
    code: "12.08",
    name: "Villa bahçe düzenlemesi, havuz",
    unit: "götürü",
    description: "Villa projeleri",
  },

  { code: "13", name: "Finansman" },
  { code: "13.01", name: "Kredi faizleri ve masrafları", unit: "götürü" },
  { code: "13.02", name: "Teminat mektubu komisyonları", unit: "götürü" },
  { code: "13.03", name: "Kur farkı", unit: "götürü", description: "Döviz bazlı alımlar" },

  { code: "14", name: "Pazarlama ve Satış" },
  {
    code: "14.01",
    name: "Dijital reklam",
    unit: "götürü",
    description: "Sosyal medya, Google",
  },
  {
    code: "14.02",
    name: "Basılı / açık hava reklam",
    unit: "götürü",
    description: "Billboard, branda, broşür",
  },
  { code: "14.03", name: "Satış ofisi / örnek daire", unit: "götürü" },
  { code: "14.04", name: "Maket, 3D render, tanıtım videosu, drone çekimi", unit: "götürü" },
  { code: "14.05", name: "Web sitesi", unit: "götürü" },
  {
    code: "14.06",
    name: "Emlakçı / satış danışmanı komisyonu",
    unit: "%",
    description: "Satış fiyatı üzerinden yüzde bazlı",
  },
  { code: "14.07", name: "Satış personeli maaş/prim", unit: "ay" },

  { code: "15", name: "Vergiler ve Diğer" },
  {
    code: "15.01",
    name: "Satışlarda KDV",
    unit: "%",
    description:
      "Konutta net alan ve arsa değerine göre, ticari bölümlerde ayrı oran (parametre tablosundan)",
  },
  {
    code: "15.02",
    name: "Kat karşılığında arsa sahibine teslimlerin vergisel etkisi",
    unit: "götürü",
    description: "Muhasebeci ile netleştirilecek",
  },
  { code: "15.03", name: "Damga vergisi", unit: "götürü" },
  { code: "15.04", name: "Emlak vergisi", unit: "götürü", description: "İnşaat süresince" },

  { code: "16", name: "Risk Payları" },
  {
    code: "16.01",
    name: "Öngörülemeyen giderler",
    unit: "%",
    description: "Yüzde olarak (örn. %5–10)",
  },
  {
    code: "16.02",
    name: "Fiyat artış payı / eskalasyon",
    unit: "%",
    description: "Aylık enflasyon varsayımı ile",
  },
  {
    code: "16.03",
    name: "Kur riski payı",
    unit: "%",
    description: "Döviz bazlı kalemler için",
  },
];

/** Kalem eklerken önerilen birimler. */
export const COST_UNITS = [
  "götürü",
  "m²",
  "m³",
  "mt",
  "ton",
  "kg",
  "adet",
  "takım",
  "ay",
  "gün",
  "saat",
  "%",
] as const;
