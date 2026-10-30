# İnşaat Maliyet ve Fiyatlandırma Programı — Proje Planı

> Durum: **Planlama aşaması tamamlandı, kararlar alındı (bkz. Bölüm 16).**
> Bu doküman uygulamaya geçmeden önce üzerinde anlaşılan kapsamı, hesaplama mantığını,
> veri modelini, ekranları ve yol haritasını tanımlar.

---

## 1. Amaç

Bir inşaat projesinin **arsa anlaşmasından iskân ve satışa kadar** bütün maliyetlerini tek yerde
toplayan, bu maliyetlerden **m² maliyeti → m² satış fiyatı → bağımsız bölüm bazında fiyat listesi**
üreten, inşaat süresince **gerçekleşen harcamaları bütçeyle karşılaştıran** ve **satış /
tahsilatları** izleyen bir program.

Üç ana çıktı:

1. **Başlangıç (yatırım öncesi) maliyetleri:** arsa / kat karşılığı, ruhsat, projelendirme, harçlar.
2. **Yapım maliyeti:** temelden ince işlere kadar her iş kalemi için *malzeme miktarı × birim fiyat*,
   buradan m² maliyeti ve daire/dükkân fiyatları.
3. **Satış ve pazarlama maliyetleri:** reklam, komisyon vb. giderlerin fiyata yansıtılması.

Ek olarak: **aynı anda yürüyen birden fazla projenin ayrı sekmelerde** takibi,
**malzeme bağlantıları (ön satın alımlar)**, **harcama girişi ve bütçe vs. gerçekleşen** takibi,
**satış ve taksit tahsilat** takibi, **nakit akışı**, **döviz/kur** takibi,
**senaryo / duyarlılık** analizi.

Kapsanan proje tipleri: **apartman/konut, villa/müstakil, ticari (dükkân/ofis), çok bloklu site**
ve bunların karışımı. Arsa modeli: **kat karşılığı, arsa satın alma veya karma**.

---

## 2. Kullanıcılar, Roller ve Temel Senaryolar

Program **ekip tarafından, ofisten ve şantiyeden telefonla** kullanılacak; bu yüzden ilk günden
itibaren kullanıcı girişi, roller ve sunucuya kurulum gerekir.

| Rol | Yetkiler |
|---|---|
| Yönetici (şirket sahibi) | Her şey; kâr marjı, fiyat listesi onayı, kullanıcı yönetimi |
| Teknik ofis / mühendis | Bina bilgileri, metraj, birim fiyat, bütçe |
| Şantiye şefi | Kendi projesine harcama girişi (mobil), hakediş hazırlama; fiyat/kâr bilgisini görmez |
| Muhasebe / ofis | Harcama girişi ve onayı, ödeme durumları, tedarikçi cari |
| Satın alma sorumlusu | Malzeme bağlantıları, teklifler, tedarikçiler, teslimat (çekiş) kayıtları |
| Satış ekibi | Fiyat listesi, müşteri, satış sözleşmesi, tahsilat; maliyet detayını görmez |
| Dış muhasebeci (opsiyonel) | Salt okunur + dönemsel Excel paketi indirme |

Yetkiler **proje bazında** verilebilir (örn. şantiye şefi sadece kendi şantiyesini görür).

**Senaryo A – Devam eden inşaat (ilk kullanım):** Mevcut faturalar Excel'den toplu aktarılır →
şantiye ve ofis yeni harcamaları girmeye başlar → kalem/tedarikçi/ay bazında harcama raporları.

**Senaryo B – Fizibilite:** Arsa bulundu → imar bilgisi ve arsa modeli girilir → program şablon
metrajla hızlı maliyet ve satış fiyatı tahmini çıkarır → "bu iş yapılır mı?" kararı.

**Senaryo C – Detaylı bütçe:** Projeler çizildi → gerçek metraj girilir → kalem kalem bütçe
→ bağımsız bölüm fiyat listesi.

**Senaryo D – Uygulama ve satış:** Harcamalar bütçeyle karşılaştırılır, güncel tahmini toplam
maliyet izlenir → daireler satılır, taksitler tahsil edilir → kalan dairelerin fiyatı gerekirse revize edilir.

**Senaryo E – Proje başlamadan bağlantı:** Yeni proje henüz fizibilite aşamasında → tedarikçiyle
500 ton demir için fiyat sabitlenir, avans ödenir → bağlantı programa girilir ve projeye (veya
"atanmamış" havuza) bağlanır → inşaat başlayınca her sevkiyat çekiş olarak düşülür, kalan miktar
ve avans bakiyesi izlenir.

**Senaryo F – Birden fazla proje:** Üç proje aynı anda yürüyor → her biri ayrı sekmede açık →
portföy panelinde tüm projelerin harcama, satış ve nakit durumu birlikte görülür.

---

## 3. Maliyet Yapısı (İş Kırılım Yapısı – İKY)

Bütün maliyetler kodlu bir **ağaç** yapısında tutulur. Kullanıcı yeni kalem ekleyebilir,
gereksizleri pasifleştirebilir. Aşağıdaki liste programın **varsayılan şablonudur**.
Harcamalar da bu kodlara bağlanarak girilir; böylece bütçe sonradan hazırlansa bile geçmiş
harcamalar otomatik olarak karşılaştırmaya dahil olur.

Çok bloklu projelerde her kalem **bloğa** veya **ortak (site geneli)** olarak işaretlenebilir;
ortak maliyetler bloklara inşaat alanı oranında (veya seçilen anahtarla) dağıtılır.

### 01 — Arsa ve Kat Karşılığı
- 01.01 Arsa bedeli (satın alma ise) veya kat karşılığı oranı (arsa sahibine düşen pay)
- 01.02 Arsa sahibine ödenen ek nakit / şerefiye (karma model)
- 01.03 Arsa sahiplerine **kira yardımı** (aylık × kişi × inşaat süresi)
- 01.04 Taşınma yardımı
- 01.05 Noter – düzenleme şeklinde kat karşılığı sözleşmesi masrafları
- 01.06 Tapu harçları, döner sermaye, kat irtifakı / kat mülkiyeti tesisi
- 01.07 Mevcut yapının yıkımı, hurda/moloz bedeli, yıkım ruhsatı
- 01.08 Danışmanlık, avukat, emlak komisyonu (arsa için)
- 01.09 Arsa sahiplerine verilen dairelerin ek talepleri (yükseltilmiş malzeme vb.)

### 02 — Ruhsat, Proje ve Resmî İşlemler
- 02.01 İmar durumu, çap, aplikasyon, röperli kroki, harita mühendisliği
- 02.02 Zemin etüdü (sondaj, laboratuvar, rapor)
- 02.03 Projeler: mimari, statik, mekanik, elektrik, peyzaj, altyapı, iksa, yangın, enerji kimlik belgesi, ısı yalıtım
- 02.04 Proje onay ve belediye harçları
- 02.05 Yapı ruhsatı harcı
- 02.06 Otopark bedeli (eksik otopark varsa)
- 02.07 Yapı denetim
  - 02.07.01 Yapı denetim hizmet bedeli (yapı sınıfı ve inşaat alanına göre hesaplanır; ödemeler
    iş ilerledikçe kademeli yapılır — programda **ödeme planı** olarak tutulur, her kademe
    ödendikçe işaretlenir)
  - 02.07.02 Laboratuvar deney ücretleri: **beton numune alma ve kırma** (her dökümde),
    **inşaat demiri çekme/eğme deneyleri**, gerekirse karot ve ek deneyler
  - 02.07.03 Ek kontrol, tekrar deney ve diğer yapı denetim kaynaklı masraflar
- 02.08 SGK – asgari işçilik / ilişiksizlik
- 02.09 Altyapı katılım payları (su, kanal, elektrik, doğalgaz)
- 02.10 Şantiye şefi / fenni mesul ücretleri
- 02.11 İskân (yapı kullanma izin) harçları, itfaiye raporu, asansör tescil
- 02.12 Abonelikler (kalıcı elektrik, su, doğalgaz)
- 02.13 Sigortalar: inşaat all-risk, işveren sorumluluk, DASK
- 02.14 İSG: risk değerlendirme, iş güvenliği uzmanı, ekipman

> Harç ve vergi oranları **koda gömülmez**; belediye/yıl bazında parametre tablosundan okunur
> çünkü her yıl ve her belediyede değişir.

### 03 — Şantiye Kurulumu ve Genel Giderler
- 03.01 Şantiye çiti, konteyner, WC, depo, şantiye elektrik/su bağlantısı
- 03.02 Kule vinç / mobil vinç (kira, kurulum, operatör)
- 03.03 İskele (kira veya alım), güvenlik ağı
- 03.04 Şantiye personeli (şef, mühendis, tekniker, bekçi, puantör)
- 03.05 Şantiye elektrik, su, yakıt, iletişim giderleri
- 03.06 Küçük alet-edevat, sarf malzeme
- 03.07 Şantiye temizliği, moloz atımı
- 03.08 Genel merkez gider payı (% olarak)

### 04 — Hafriyat ve Zemin
- 04.01 Kazı (m³), nakliye, döküm sahası bedeli
- 04.02 İksa: fore kazık, ankraj, püskürtme beton
- 04.03 Zemin iyileştirme (jet-grout vb.)
- 04.04 Dolgu, sıkıştırma, drenaj
- 04.05 Su çekme (gerekirse)

### 05 — Temel ve Betonarme (Kaba İnşaat)
- 05.01 Grobeton
- 05.02 Temel altı / perde su yalıtımı, koruma betonu
- 05.03 Radye / sürekli temel betonu
- 05.04 Beton
  - 05.04.01 Hazır beton (sınıf bazında: C25, C30, C35 …) – m³
  - 05.04.02 Beton pompası (m³ veya sefer bazlı), mikser bekleme ücreti
  - 05.04.03 Beton katkıları (su geçirimsizlik, antifriz, priz geciktirici)
  - 05.04.04 Gece / hafta sonu döküm farkı
  - 05.04.05 Döküm işçiliği, vibratör, perdah
  - 05.04.06 Kür (sulama, kür örtüsü/kimyasalı), kış şartlarında örtü ve ısıtma
  - Beton deneyleri 02.07.02 altında izlenir; her döküm kaydı (tarih, kat/eleman, m³, beton
    sınıfı, irsaliye) ilgili deney ve pompa giderleriyle ilişkilendirilebilir.
- 05.05 İnşaat demiri (çap bazında) – ton, kesme-bükme işçiliği
- 05.06 Kalıp (temel, perde, kolon, kiriş, döşeme) – m², kalıp malzemesi/kira
- 05.07 Betonarme işçiliği (m² veya m³ bazlı taşeron)
- 05.08 Merdivenler, asansör kuyusu
- 05.09 Topraklama (temel topraklaması)

### 06 — Duvarlar ve Çatı
- 06.01 Dış duvar (bims / tuğla / gazbeton) – m², harç
- 06.02 İç bölme duvarlar
- 06.03 Lento, hatıl
- 06.04 Çatı: ahşap/çelik konstrüksiyon, OSB, su yalıtımı, kiremit/panel, oluk-iniş borusu
- 06.05 Teras çatı: eğim betonu, ısı + su yalıtımı, koruma

### 07 — Cephe
- 07.01 Mantolama (ısı yalıtım levhası, yapıştırıcı, dübel, file, sıva, boya)
- 07.02 Dış cephe kaplama (kompozit, taş, seramik vb.)
- 07.03 Cephe iskelesi (03.03 ile ilişkili)
- 07.04 Denizlikler, parapetler
- 07.05 Dükkân vitrin camları, kepenk (ticari bölümler)

### 08 — İnce İşler
- 08.01 İç sıva (kaba + ince / makine alçı sıvası)
- 08.02 Saten alçı, köşe profili
- 08.03 Şap (m², kalınlık)
- 08.04 Islak hacim su yalıtımı
- 08.05 Seramik / granit (zemin + duvar), yapıştırıcı, derz
- 08.06 Laminat / parke, süpürgelik
- 08.07 Asma tavan (alçıpan), kartonpiyer
- 08.08 İç boya (astar + son kat)
- 08.09 Pencere doğramaları (PVC / alüminyum), cam, pervaz
- 08.10 Balkon korkulukları, küpeşte
- 08.11 Çelik kapı, iç kapılar, kapı kolları
- 08.12 Mutfak dolapları, tezgâh
- 08.13 Banyo: vitrifiye, batarya, duşakabin, lavabo dolabı, ayna
- 08.14 Ankastre set (verilecekse)
- 08.15 Vestiyer, gömme dolap
- 08.16 Merdiven kaplaması, korkuluklar

### 09 — Mekanik Tesisat
- 09.01 Temiz su tesisatı (boru, fittings, kollektör), su deposu, hidrofor
- 09.02 Pis su tesisatı, yağmur suyu
- 09.03 Doğalgaz tesisatı, kombi / merkezi sistem
- 09.04 Isıtma: radyatör veya yerden ısıtma
- 09.05 Havalandırma, aspiratör
- 09.06 Yangın tesisatı (sprinkler, dolap, tüp)
- 09.07 Klima altyapısı (verilecekse)

### 10 — Elektrik ve Zayıf Akım
- 10.01 Kablo, buat, boru, anahtar-priz, sigorta panoları
- 10.02 Aydınlatma armatürleri (ortak alan + daire)
- 10.03 Topraklama, paratoner
- 10.04 Diyafon / görüntülü diyafon, uydu, internet altyapısı
- 10.05 Yangın algılama, kamera, kartlı geçiş
- 10.06 Jeneratör (varsa), trafo payı

### 11 — Asansör
- 11.01 Asansör(ler): makine, kabin, ray, kapılar, montaj, ilk tescil

### 12 — Ortak Alanlar, Peyzaj ve Çevre Düzeni
- 12.01 Giriş holü, merdiven holleri kaplama ve aydınlatma
- 12.02 Otopark: epoksi zemin, çizgi, havalandırma
- 12.03 Peyzaj: bitkilendirme, sulama, bahçe duvarı
- 12.04 Bahçe kapısı, sınır duvarı, korkuluk
- 12.05 Sosyal alanlar (havuz, spor salonu, çocuk parkı – site projelerinde)
- 12.06 Çöp odası, sığınak
- 12.07 Site altyapısı: iç yollar, güvenlik kulübesi, çevre aydınlatması (çok bloklu projeler)
- 12.08 Villa bahçe düzenlemesi, havuz (villa projeleri)

### 13 — Finansman
- 13.01 Kredi faizleri ve masrafları
- 13.02 Teminat mektubu komisyonları
- 13.03 Kur farkı (döviz bazlı alımlar)

### 14 — Pazarlama ve Satış
- 14.01 Dijital reklam (sosyal medya, Google)
- 14.02 Basılı / açık hava reklam (billboard, branda, broşür)
- 14.03 Satış ofisi / örnek daire
- 14.04 Maket, 3D render, tanıtım videosu, drone çekimi
- 14.05 Web sitesi
- 14.06 Emlakçı / satış danışmanı komisyonu (**% bazlı**)
- 14.07 Satış personeli maaş/prim

### 15 — Vergiler ve Diğer
- 15.01 Satışlarda KDV (konutta net alan ve arsa değerine göre, ticari bölümlerde ayrı oran — parametrik)
- 15.02 Kat karşılığında arsa sahibine teslimlerin vergisel etkisi (muhasebeci ile netleştirilecek)
- 15.03 Damga vergisi
- 15.04 Emlak vergisi (inşaat süresince)

### 16 — Risk Payları
- 16.01 Öngörülemeyen giderler (% — örn. %5–10)
- 16.02 Fiyat artış payı / eskalasyon (aylık enflasyon varsayımı ile)
- 16.03 Kur riski payı (döviz bazlı kalemler için)

---

## 4. Malzeme ve Fiyat Kütüphanesi

"Bütün malzemelerin eksiksiz belirlenmesi" için iki katmanlı yapı:

### 4.1 Malzeme / kaynak kütüphanesi
Her kayıt: **kod, ad, kategori, birim (m³, ton, m², adet, kg, mt, takım), marka/özellik,
fire oranı (%)**, varsayılan tedarikçi, **varsayılan para birimi**.

Kaynak türleri: **Malzeme**, **İşçilik** (usta/düz işçi saat veya taşeron birim fiyatı),
**Makine/Ekipman** (saat/gün kira), **Hizmet** (proje, danışmanlık).

### 4.2 Birim fiyat analizi (reçete) ve temin şekli
Taşeron yapısı **işe göre karışık** olduğu için her maliyet kaleminde **temin şekli** seçilir:

| Temin şekli | Nasıl fiyatlanır | Harcama nasıl girilir |
|---|---|---|
| **Malzemeli taşeron** (anahtar teslim) | Taşeronun m²/m³/adet birim fiyatı | Taşeron hakedişi |
| **Malzeme bizden + taşeron işçilik** | Reçetenin malzeme kısmı + taşeron işçilik birim fiyatı | Malzeme faturaları + işçilik hakedişi |
| **Tamamen bizden** (kendi ekip) | Reçete: malzeme + işçilik + makine | Malzeme faturaları + puantaj/maaş |

Reçete örneği:

```
1 m² Zemin seramiği =
    1,00 m² seramik          × (1 + %8 fire)
  + 5,0 kg yapıştırıcı
  + 0,4 kg derz dolgu
  + 1 m² seramik ustalığı (işçilik)
```

Malzeme fiyatı değiştiğinde onu kullanan **tüm iş kalemleri ve bütçe otomatik güncellenir**.
"Malzeme bizden" işlerde taşerona teslim edilen malzeme miktarı da izlenebilir (fire kontrolü).

### 4.3 Fiyat geçmişi
- Her fiyat **tarihli**, **kaynaklı** (tedarikçi teklifi, fatura, piyasa araştırması) ve
  **para birimli** tutulur.
- Elde düzenli fiyat tablosu olmadığı, **sadece fatura kayıtları** olduğu için: fatura içe aktarımı
  sırasında kalemler malzemelerle eşleştirilir ve **son alım fiyatları kütüphaneye otomatik yazılır**.
  Kütüphane, girilen her faturayla zamanla dolar.
- Enflasyonist ortam için: fiyat tarihi + aylık artış varsayımı ile ileri tarihli fiyat tahmini.
- Opsiyonel: resmî birim fiyat (poz) listelerinin içe aktarılması.
- Bütçede kullanılacak fiyatın önceliği: **geçerli bağlantı fiyatı** (Bölüm 9) → son alım
  (fatura) fiyatı → güncel teklif → piyasa araştırması. Kullanıcı kalem bazında değiştirebilir.

### 4.4 Döviz ve kur
- Fiyat ve harcamalar **TL, USD, EUR** (gerekirse başka) olarak girilebilir.
- **Kur tablosu:** TCMB günlük kurları otomatik çekilir; elle de girilebilir.
- Harcamada **işlem kuru** kaydedilir; raporlar TL'ye çevrilmiş tutarla, istenirse orijinal
  para birimiyle gösterilir.
- Bütçede döviz bazlı kalemler kur varsayımı ile TL'ye çevrilir; kur değişimi senaryolara girer.

---

## 5. Projeler, Bina ve Bağımsız Bölüm Tanımı

### 5.1 Çoklu proje yönetimi ve proje sekmeleri
Aynı anda birden fazla proje yürütüldüğü için program **çok projeli** kurulur.

```
┌──────────────────────────────────────────────────────────────────────┐
│ [Portföy] [Kadıköy Konutları ×] [Çamlık Villaları ×] [+ Yeni proje]  │  ← proje sekmeleri
├──────────────┬───────────────────────────────────────────────────────┤
│ Proje paneli │                                                       │
│ Harcamalar   │       Seçili projenin ekranı                          │
│ Bütçe        │                                                       │
│ Bölümler     │                                                       │
│ Satışlar     │                                                       │
│ ...          │                                                       │
│──────────────│                                                       │
│ Şirket geneli│                                                       │
│ Bağlantılar  │                                                       │
│ Tedarikçiler │                                                       │
│ Kütüphane    │                                                       │
└──────────────┴───────────────────────────────────────────────────────┘
```

- **Proje sekmeleri:** Açık projeler üst çubukta tarayıcı sekmesi gibi durur; tek tıkla projeler
  arasında geçilir. **"+ Yeni proje"** sekmesi yeni proje sihirbazını açar. Açık sekmeler
  kullanıcı bazında hatırlanır; kapatılan proje silinmez, proje listesinden yeniden açılır.
- **Veriler proje bazında ayrıdır:** her projenin kendi bütçesi, harcamaları, bağımsız bölümleri,
  satışları ve nakit akışı vardır; kayıtlar birbirine karışmaz. Her harcama, bağlantı çekişi ve
  satış mutlaka bir projeye bağlıdır.
- **Şirket geneli ortak veriler:** malzeme/fiyat kütüphanesi, tedarikçi ve taşeronlar, kurlar,
  şablonlar ve malzeme bağlantıları bütün projelerce ortak kullanılır (bir projede girilen
  faturanın fiyatı diğer projelerin bütçe önerilerine de yansır).
- **Proje durumu:** Fizibilite → Ruhsat → İnşaat → Satış → Tamamlandı → Arşiv. Henüz
  başlamamış projeler de açılabilir; böylece başlamadan yapılan bağlantılar ona atanabilir.
- **Portföy paneli:** tüm projelerin özet kartları (bütçe, harcanan, sapma, ilerleme, satış,
  tahsilat) ve şirket geneli toplamlar; tüm projelerde bu hafta ödenecekler ve bağlantı uyarıları.
- **Ortak giderlerin dağıtımı:** genel merkez giderleri, ortak reklam, birden fazla şantiyeye
  gelen tek fatura → dağıtım anahtarıyla (alan oranı, bütçe oranı veya elle) projelere bölünür.
- **Projeler arası malzeme transferi:** bir şantiyede artan malzeme diğerine gönderildiğinde
  maliyeti de aktarılır ve kaydı tutulur.
- **Projeler arası karşılaştırma:** m² maliyeti, kalem bazında birim fiyat, süre, kâr.
- **Proje kopyalama:** benzer yeni proje, mevcut projeden (İKY ağacı, reçeteler, katsayılar)
  kopyalanarak açılır.
- **Yetki:** kullanıcı sadece yetkili olduğu projelerin sekmelerini görür; mobilde şantiye
  şefinin kendi projesi otomatik seçilir.

### 5.2 Proje bilgileri
Proje adı, tipi (konut / villa / ticari / karma / site), durumu, arsa alanı, emsal (KAKS), TAKS,
blok sayısı, başlangıç tarihi, süre (ay), proje para birimi (raporlama: TL).

### 5.3 Arsa modeli
- **Kat karşılığı:** arsa sahipleri, pay oranları, kendilerine verilecek bölümler, kira yardımları.
- **Satın alma:** arsa bedeli, ödeme planı, tapu masrafları.
- **Karma:** kat karşılığı + nakit ödeme / şerefiye birlikte.

### 5.4 Bloklar
Her blok için: ad, kat adedi, bodrum sayısı, kat yüksekliği, blok inşaat alanı, asansör sayısı.
Villa projelerinde her villa bir "blok" olarak tanımlanır.

### 5.5 Bağımsız bölümler
Her bölüm için: blok, kat, kapı no, **kullanım tipi (konut / dükkân / ofis / depo)**,
tip (1+1, 2+1, 3+1, dubleks, bahçe katı, villa …), **net m²**, **brüt m²**, ortak alan payı,
cephe (K/G/D/B), manzara, balkon/teras/bahçe alanı,
**sahibi (Müteahhit / Arsa Sahibi X)**, satış durumu.

> Arsa sahiplerine hangi bölümlerin verileceği burada işaretlenir. Program, sözleşmedeki
> oran (örn. %45) ile işaretlenen bölümlerin m² toplamını karşılaştırıp uyarı verir.

---

## 6. Metraj (Miktar Hesabı)

Üç seviyeli metraj, projenin olgunluğuna göre:

| Seviye | Ne zaman | Nasıl |
|---|---|---|
| **1. Parametrik** | Fizibilite | İnşaat alanı × katsayı (örn. m² başına beton m³, demir kg). Katsayılar düzenlenebilir şablonda. |
| **2. Yarı detaylı** | Avan proje | Kat alanları, duvar uzunlukları, ıslak hacim sayısı, pencere adedi gibi girdilerden formülle |
| **3. Detaylı** | Uygulama projesi | Kalem kalem gerçek metraj girişi veya Excel'den içe aktarma |

Her kalemde kaynak etiketi tutulur (parametrik / formül / manuel) — hangi rakamın tahmin,
hangisinin kesin olduğu raporda görünür.

Parametrik katsayı örnekleri (yalnızca **başlangıç varsayımı**, gerçek projelerle kalibre edilecek):
- Beton: ~0,35–0,50 m³ / m² inşaat alanı
- Demir: ~35–50 kg / m² inşaat alanı
- Kalıp: ~2,5–3,5 m² / m² inşaat alanı
- İç sıva / boya: ~2,5–3,0 m² / m² net alan

> Geçmiş metraj verisi olmadığı için ilk projede varsayılan katsayılar kullanılacak; devam eden
> inşaatın gerçekleşen harcamaları (fatura miktarları) girildikçe program "gerçekleşen katsayı"
> hesaplar (örn. gerçek beton m³ / inşaat m²) ve sonraki projelerde bunu önerir.

---

## 7. Hesaplama Motoru

### 7.1 Kalem maliyeti
```
Kalem Maliyeti = Miktar × Birim Fiyat × (1 + Fire %)  × Kur (döviz bazlıysa)
Birim Fiyat    = Σ (reçete kaynak miktarı × kaynak fiyatı)  — veya doğrudan taşeron fiyatı
```

### 7.2 Toplam maliyet
```
Toplam Maliyet = Arsa/KK + Ruhsat/Proje + Şantiye/Genel + Yapım (04–12)
               + Finansman + Sabit Pazarlama + Risk payları
```
(Yüzde bazlı satış komisyonu ve KDV fiyatlandırma aşamasında eklenir.)
Çok bloklu projelerde toplam maliyet blok bazında da raporlanır (blok kalemleri + ortak payı).

### 7.3 m² maliyetleri
- **İnşaat m² maliyeti** = Yapım maliyeti / Toplam inşaat alanı  → teknik kıyas için
- **Satılabilir m² maliyeti (müteahhit)** = Toplam maliyet / *Müteahhide kalan* satılabilir brüt m²

> Kritik nokta: kat karşılığı işlerde arsa sahibine verilen bölümlerin inşaat maliyeti de
> müteahhit tarafından karşılanır. Bu yüzden toplam maliyet **tüm binayı**, gelir ise **sadece
> müteahhit bölümlerini** kapsar. Program bu ayrımı otomatik yapar.

### 7.4 Pazarlama giderinin fiyata eklenmesi
- **Sabit reklam bütçesi** → müteahhit satılabilir m²'sine dağıtılır (m² başına TL).
- **Yüzde bazlı giderler** (emlakçı komisyonu vb.) → satış fiyatı üzerinden hesaplandığı için
  fiyata "brütleştirme" ile eklenir.

### 7.5 Baz m² satış fiyatı
Program **iki kâr yöntemini de** gösterir; proje bazında hangisinin esas alınacağı seçilir:

```
Satış üzerinden marj:   Baz m² = (Satılabilir m² maliyeti + Reklam m² payı) / (1 − Komisyon % − Marj %)
Maliyet üzerine ekleme: Baz m² = (Satılabilir m² maliyeti + Reklam m² payı) × (1 + Kâr %) / (1 − Komisyon %)
```
Ekranda her iki karşılık birlikte görünür (örn. "%25 marj = maliyet üzerine %33,3").
Ayrıca **başabaş m² fiyatı** (kâr = 0) gösterilir.

Karma projelerde (konut + dükkân) **kullanım tipine göre ayrı baz fiyat** belirlenebilir; maliyet
yine tek havuzdan gelir, kullanıcı ticari/konut fiyat oranını belirler (örn. dükkân = konut × 1,8).

### 7.6 Bağımsız bölüm fiyatı
```
Bölüm Fiyatı = Baz m² Fiyatı (kullanım tipine göre) × Brüt m²
               × Kat katsayısı × Cephe katsayısı × Manzara katsayısı × Tip katsayısı
               (+ bahçe/teras ek bedeli)
```
- **Katsayıları kullanıcı belirler.** Tablolar boş (tümü 1,00) gelir; her projede ekip doldurur.
  Kolaylık için "önceki projeden katsayıları kopyala" seçeneği olur.
- **Normalizasyon:** katsayılar uygulandıktan sonra tüm müteahhit bölümlerinin toplam fiyatı,
  hedef toplam gelire eşitlenir — böylece katsayılar kârı bozmaz, sadece dağılımı değiştirir.
- KDV hariç / dahil fiyatlar ayrı gösterilir; KDV oranı bölüm bazında parametreye göre belirlenir.
- Fiyatlar yuvarlama kuralına göre yuvarlanır (örn. en yakın 10.000 TL).
- **Satılmış bölümlerin fiyatı kilitlenir.** Maliyet değişince yeniden fiyatlama sadece satılmamış
  bölümlere uygulanır; hedef kâra ulaşmak için kalan bölümlerin ne kadar artması gerektiği gösterilir.

### 7.7 Sayısal örnek (temsili rakamlar, gerçek fiyat değildir)
| Girdi | Değer |
|---|---|
| Toplam inşaat alanı | 3.000 m² |
| Bağımsız bölümlerin toplam satılabilir brüt alanı | 2.400 m² |
| Arsa sahibi payı | %45 → müteahhide kalan 1.320 m² |
| Toplam maliyet (komisyon hariç) | 90.000.000 TL |
| Sabit reklam bütçesi | 3.000.000 TL |
| Emlakçı komisyonu | %2 |
| Hedef kâr marjı | %25 (satış üzerinden) |

- İnşaat m² maliyeti ≈ 90.000.000 / 3.000 = **30.000 TL/m²**
- Müteahhit satılabilir m² maliyeti ≈ 90.000.000 / 1.320 = **68.182 TL/m²**
- Reklam payı ≈ 3.000.000 / 1.320 = **2.273 TL/m²** → 70.455 TL/m²
- Baz satış fiyatı ≈ 70.455 / (1 − 0,02 − 0,25) = **≈ 96.514 TL/m²** (KDV hariç)
- 120 m² daire, kullanıcının girdiği katsayılar kat 1,05 ve cephe 1,03 ise
  ≈ 96.514 × 120 × 1,05 × 1,03 ≈ **12,53 M TL** (normalizasyon öncesi)

### 7.8 Zaman ve nakit akışı
- Her kalemin hangi ay(lar)da harcanacağı (iş programı / basit Gantt) girilir.
- Aylık nakit çıkışı = planlanan harcamalar (gerçekleşen aylarda gerçek harcamalar)
  + bağlantı ödeme planları.
- **Şirket geneli konsolide nakit akışı:** tüm projelerin toplamı + atanmamış bağlantılar
  + genel merkez giderleri.
- Aylık nakit girişi = satış modülündeki **taksit planları ve gerçek tahsilatlar** + satılmamış
  bölümler için satış hızı varsayımı.
- Kümülatif nakit ihtiyacı, enflasyon ve kur varsayımı ile ileri tarihli maliyet;
  finansman maliyeti bu nakit açığından hesaplanır.

### 7.9 Senaryo ve duyarlılık
- Senaryo kopyalama: "İyimser / Baz / Kötümser".
- Duyarlılık: "Demir %15 artarsa", "USD %20 artarsa", "inşaat 3 ay uzarsa", "arsa payı %50 olursa"
  → m² fiyatına ve kâra etkisi.
- En çok etki eden ilk 10 kalem (tornado grafiği).

---

## 8. Harcama Takibi (Bütçe vs. Gerçekleşen) — **İlk sürümün odağı**

Devam eden bir inşaat olduğu için program önce **harcama girişi** ile devreye alınacak.

### 8.1 Harcama kaydı alanları
Tarih, proje/blok, maliyet kalemi (İKY kodu), malzeme/kaynak, tedarikçi/taşeron, miktar, birim,
birim fiyat, **para birimi ve kur**, KDV oranı, tutar (orijinal + TL), belge türü
(fatura / irsaliye / fiş / hakediş / makbuz), belge no, ödeme durumu ve vadesi, ödeme yöntemi
(nakit / havale / çek / senet / kredi kartı), **belge fotoğrafı/PDF**, açıklama, giren kişi,
onay durumu, **bağlı olduğu bağlantı veya taşeron sözleşmesi** (varsa).
Birden fazla projeyi ilgilendiren bir fatura, dağıtım anahtarıyla projelere bölünebilir.

### 8.2 Kolay giriş için tasarım ilkeleri
- **Mobil öncelikli hızlı giriş:** şantiyede telefondan; fiş/fatura fotoğrafı çek → kalem seç →
  tutar gir → kaydet. Telefona uygulama gibi eklenebilir (PWA).
- **Yazdıkça ara** (autocomplete): kalem, malzeme, tedarikçi. Son kullanılan tedarikçi ve fiyat
  otomatik önerilir.
- **Tablo modu (ofis):** Excel benzeri ızgarada çoklu satır girişi, Excel'den kopyala-yapıştır.
- **Excel / CSV içe aktarma:** sütun eşleştirme sihirbazı; mevcut fatura kayıtlarının toplu aktarımı.
- **Şablonlar:** tekrarlayan giderler (kira yardımı, maaş, vinç kirası) tek tıkla.
- **Hakediş girişi:** taşeron sözleşmesi (birim fiyatlar, miktarlar) → dönem ilerlemesi →
  kesintiler (avans, teminat, malzeme mahsubu) → net ödeme.
- **Onay akışı:** şantiyeden girilen harcama ofiste kontrol edilip onaylanır.
- **Doğrulama uyarıları:** bütçeyi aşan kalem, alışılmadık birim fiyat, aynı tedarikçide
  mükerrer fatura no, eksik belge fotoğrafı.
- Sonraki aşama: **e-Fatura / e-Arşiv XML** içe aktarma (kalemlerin otomatik okunması),
  şantiyede internet yokken girip sonra senkronize etme (çevrimdışı mod).

### 8.3 Takip çıktıları
- Kalem bazında: Bütçe / Gerçekleşen / Sapma / % tamamlanma
- **Tahmini tamamlanma maliyeti (EAC)** = Gerçekleşen + Kalan iş × güncel birim fiyat
- Güncellenmiş m² maliyeti ve kâr marjına etkisi → fiyat listesini revize etme önerisi
- Tedarikçi / taşeron bazında cari, borç ve **vade listesi** (bu hafta ödenecekler)
- Ay / kalem / tedarikçi / blok bazında harcama raporları (bütçe hazır olmasa da çalışır)

### 8.4 Muhasebeci paketi
Şirkette muhasebe programı yok, defterleri dış muhasebeci tutuyor. Bu nedenle:
- Dönem seçilerek **Excel paketi** indirilir: fatura listesi (tedarikçi, vergi no, belge no, tarih,
  matrah, KDV oranı/tutarı, toplam), belge görselleri (ZIP), tedarikçi cari özetleri,
  satış faturaları ve tahsilatlar.
- İstenirse muhasebeciye salt okunur kullanıcı açılır.

---

## 9. Satın Alma ve Malzeme Bağlantıları

### 9.1 Bağlantı nedir
Proje başlamadan veya inşaat sırasında tedarikçiyle belirli bir malzeme için **miktar ve fiyatın
önceden sabitlenmesi** (örn. 500 ton demir, 3.000 m³ beton, 8.000 m² seramik, tüm doğramalar).
Ödeme çoğunlukla peşin/avans veya vadeli yapılır; malzeme zamana yayılarak **çekilir**.

### 9.2 Bağlantı kaydı
- Bağlantı no, tarih, tedarikçi, sözleşme/teklif belgesi (PDF/fotoğraf)
- **Kalemler:** malzeme, miktar, birim, birim fiyat, para birimi, KDV
- **Fiyat tipi:** sabit TL / döviz bazlı (çekiş veya ödeme günü kuru) / belli tarihe kadar sabit, sonrası güncel fiyat
- Geçerlilik ve **son çekiş tarihi**, teslim yeri, nakliye ve boşaltma dahil mi
- **Ödeme planı:** avans, taksitler, çek/senet, vadeler
- **Proje tahsisi** (aşağıda) ve durum (Taslak / Aktif / Tamamlandı / İptal)

### 9.3 Proje tahsisi
- Bağlantı **tek projeye**, **birkaç projeye** (miktar paylaştırılarak, örn. 300 ton A, 200 ton B)
  veya **"atanmamış – şirket geneli"** havuza bağlanabilir.
- Proje başlamadan yapılan bağlantı, proje fizibilite durumundayken ona atanır; proje henüz
  açılmamışsa havuzda bekler, proje açılınca atanır.
- Tahsis sonradan değiştirilebilir (bir projenin payı diğerine aktarılabilir); geçmişi tutulur.

### 9.4 Çekişler (teslimatlar)
- Her sevkiyat **irsaliye ile** girilir: tarih, miktar, hangi proje/şantiye, irsaliye no, fotoğraf.
  Şantiye şefi mobilden "malzeme geldi" kaydı açabilir.
- **Bağlantı bakiyesi:** toplam / çekilen / kalan miktar ve tutar, proje bazında dağılım.
- Teslim edilen miktar, o projenin **gerçekleşen maliyetine bağlantı fiyatıyla** yazılır.
  Yani maliyet ödeme anında değil, malzeme projeye girdiğinde oluşur; avans ise ayrı izlenir.

### 9.5 Ödemeler ve faturalar
- Ödeme planı ve gerçekleşen ödemeler; **avans bakiyesi** = ödenen − teslim alınan malzeme değeri.
- Tedarikçiden gelen faturalar bağlantıya bağlanır; fatura miktarı ve fiyatı bağlantıyla
  otomatik karşılaştırılır, fark varsa uyarı verilir.
- Tedarikçi cari ekranında bağlantılar, avanslar, teslimatlar ve faturalar birlikte görünür.

### 9.6 Bütçe ve fiyatlandırmaya etkisi
- Geçerli bağlantı fiyatı, ilgili projelerin bütçesinde **öncelikli birim fiyat** olur (kilitli fiyat).
- **Kapsama analizi:** bütçedeki ihtiyaç miktarı ↔ bağlantılı miktar
  (örn. "demir ihtiyacının %70'i bağlantılı, 150 ton açık") → eksik veya fazla bağlantı uyarısı.
- **Bağlantı kazancı:** bağlantı fiyatı ile güncel piyasa / son alım fiyatı arasındaki fark raporlanır.
- Bağlantı ödeme planları nakit akışına (7.8) çıkış olarak girer.

### 9.7 Uyarılar
Son çekiş tarihi yaklaşan, kalan miktarı azalan, fiyat geçerliliği biten, ödeme vadesi gelen
bağlantılar; bağlantı fiyatından farklı kesilen faturalar; çekilmeyen ve süresi dolmak üzere
olan avanslar.

---

## 10. Satış ve Tahsilat Takibi

- **Müşteri kaydı:** ad, iletişim, kimlik/vergi bilgileri (KVKK'ya uygun, yetkiyle sınırlı erişim).
- **Rezervasyon / opsiyon:** süreli; süresi dolan rezervasyon otomatik boşa düşer.
- **Satış sözleşmesi:** bölüm, liste fiyatı, indirim, satış fiyatı, KDV, döviz bazlı satış (varsa),
  emlakçı ve komisyon tutarı.
- **Ödeme planı:** peşinat + taksitler (tarih, tutar), ara ödemeler, anahtar teslim ödemesi;
  istenirse kredi (banka) ile ödenecek kısım.
- **Tahsilat girişi:** taksite bağlı tahsilat, kısmi ödeme, çek/senet takibi.
- **Uyarılar:** yaklaşan ve geciken taksitler listesi.
- Raporlar: satılan / rezerve / boş bölümler, toplam satış, tahsil edilen / kalan alacak,
  hedef gelire göre durum; nakit akışına (7.8) doğrudan beslenir.
- Arsa sahibi bölümleri satış listesinde ayrı gösterilir (satılamaz, teslim takibi yapılır).

---

## 11. Ekranlar (Arayüz)

Yerleşim: üstte **proje sekmeleri**, solda seçili projenin menüsü ve altında şirket geneli
ekranlar (bkz. 5.1). Mobilde sekmeler yerine üstte proje seçici bulunur.

**Şirket geneli ekranlar**

| # | Ekran | İçerik |
|---|---|---|
| 1 | **Portföy paneli** | Tüm projelerin özet kartları (bütçe, harcanan, sapma, ilerleme, satış, tahsilat), konsolide nakit, tüm projelerde bu hafta ödenecekler, bağlantı uyarıları |
| 2 | **Malzeme bağlantıları** | Bağlantı listesi; bakiye (toplam / çekilen / kalan), proje tahsisi, çekiş ve ödeme girişi, avans bakiyesi, uyarılar |
| 3 | **Tedarikçiler / taşeronlar** | İletişim, teklifler, bağlantılar, sözleşmeler, hakedişler, cari, vade listesi |
| 4 | **Malzeme & fiyat kütüphanesi** | Malzemeler, işçilik, makine; fiyat geçmişi; bağlantı fiyatları; reçeteler |
| 5 | **Projeler arası raporlar** | Karşılaştırma (m² maliyet, birim fiyatlar, kâr), konsolide harcama ve nakit |
| 6 | **Ayarlar** | Kullanıcılar ve proje yetkileri, harç/vergi parametreleri, kurlar, birimler, şablonlar |

**Proje sekmesi içindeki ekranlar**

| # | Ekran | İçerik |
|---|---|---|
| 7 | **Yeni proje sihirbazı** | "+ Yeni proje" sekmesinden: proje tipi → arsa modeli → imar → bloklar → bağımsız bölümler → hızlı tahmin; şablondan veya mevcut projeden kopyalama |
| 8 | **Proje paneli** | Seçili projede harcama, bütçe sapması, m² maliyet, kâr, satış ve tahsilat durumu, ödenecekler, projeye bağlı bağlantılar |
| 9 | **Mobil harcama / malzeme girişi** | Proje seçimi (son proje varsayılan) + fotoğraf + kalem + tutar; "malzeme geldi" (bağlantı çekişi); son girişlerim |
| 10 | **Harcamalar (ofis)** | Tablo modu, filtreler, onay, içe aktarma, belge görüntüleme, projelere bölme |
| 11 | **Arsa & sözleşme** | Arsa sahipleri, paylar, kira yardımları, satın alma ödeme planı |
| 12 | **Bloklar & bağımsız bölümler** | Kat kat bölüm listesi, sahiplik işaretleme, alan kontrolleri |
| 13 | **Maliyet ağacı / bütçe** | İKY ağacı; temin şekli, miktar, birim fiyat (bağlantı fiyatı işaretli), tutar, metraj kaynağı, bütçe vs gerçekleşen, bağlantı kapsaması |
| 14 | **Metraj** | Parametrik katsayılar, formül girdileri, manuel/Excel metraj |
| 15 | **Fiyatlandırma** | Kâr yöntemi, reklam, komisyon, katsayı tabloları → bölüm fiyat listesi; KDV hariç/dahil |
| 16 | **Satış & müşteriler** | Bölüm durumu (kat planı görünümü), rezervasyon, sözleşme, ödeme planı |
| 17 | **Tahsilatlar** | Taksit takvimi, gecikenler, tahsilat girişi |
| 18 | **Nakit akışı & iş programı** | Aylık harcama/tahsilat/bağlantı ödemeleri, Gantt |
| 19 | **Senaryolar** | Senaryo kıyası, duyarlılık |
| 20 | **Raporlar** | PDF/Excel: harcama, bütçe, sapma, fiyat listesi, satış/tahsilat, muhasebeci paketi, fizibilite |

---

## 12. Veri Modeli (Ana Tablolar)

```
Kullanıcı        (id, ad, e-posta, telefon, rol, aktif)
ProjeYetkisi     (kullanıcı_id, proje_id, rol)
Proje            (id, ad, tip, adres, ada/parsel, arsa_alanı, emsal, taks, arsa_modeli,
                  başlangıç, süre_ay, durum)
Blok             (id, proje_id, ad, kat_sayısı, bodrum_sayısı, inşaat_alanı)
BağımsızBölüm    (id, blok_id, kat, no, kullanım_tipi, tip, net_m2, brüt_m2, cephe, manzara,
                  ek_alanlar, sahip_tipi, arsa_sahibi_id, satış_durumu, liste_fiyatı, fiyat_kilitli)
ArsaSahibi       (id, proje_id, ad, pay_oranı, kira_yardımı_aylık, iletişim)
MaliyetKalemi    (id, proje_id, blok_id|ortak, üst_id, kod, ad, birim, temin_şekli, miktar,
                  metraj_kaynağı, birim_fiyat, para_birimi, fire, tutar, başlangıç_ay, bitiş_ay)
Kaynak           (id, kod, ad, tür[malzeme|işçilik|makine|hizmet], birim, kategori, fire, para_birimi)
KaynakFiyatı     (id, kaynak_id, fiyat, para_birimi, tarih, kaynak[teklif|fatura|piyasa], tedarikçi_id)
Reçete           (id, ad, birim)  +  ReçeteSatırı (reçete_id, kaynak_id, miktar)
ParametrikKatsayı(id, ad, formül/katsayı, uygulandığı_kalem)
Kur              (tarih, para_birimi, alış, satış, kaynak[TCMB|manuel])
Tedarikçi        (id, ad, vergi_no, tür[tedarikçi|taşeron], iletişim, iban)
Bağlantı         (id, no, tarih, tedarikçi_id, fiyat_tipi, geçerlilik, son_çekiş_tarihi,
                  teslim_yeri, nakliye_dahil, durum, belge_id)
BağlantıKalemi   (id, bağlantı_id, kaynak_id, miktar, birim, birim_fiyat, para_birimi, kdv)
BağlantıTahsisi  (id, bağlantı_kalemi_id, proje_id|null(atanmamış), miktar)
BağlantıÇekişi   (id, bağlantı_kalemi_id, proje_id, tarih, miktar, irsaliye_no, belge_id, giren)
BağlantıÖdemesi  (id, bağlantı_id, vade, tutar, para_birimi, ödendi_mi, ödeme_tarihi, yöntem)
MalzemeTransferi (id, kaynak_proje_id, hedef_proje_id, kaynak_id, miktar, tutar, tarih)
KullanıcıSekmesi (kullanıcı_id, proje_id, sıra)  — açık proje sekmelerinin hatırlanması
TaşeronSözleşmesi(id, proje_id, tedarikçi_id, kapsam, temin_şekli, birim_fiyatlar, teminat_%)
Hakediş          (id, sözleşme_id, dönem, ilerleme, brüt, kesintiler, net)
Harcama          (id, proje_id, blok_id, maliyet_kalemi_id, kaynak_id, tedarikçi_id, tarih, miktar,
                  birim_fiyat, para_birimi, kur, kdv, tutar, tutar_tl, belge_türü, belge_no,
                  ödeme_durumu, vade, ödeme_yöntemi, onay_durumu, giren, onaylayan,
                  bağlantı_id, sözleşme_id)
HarcamaDağılımı  (harcama_id, proje_id, oran, tutar)  — bir faturanın projelere bölünmesi
Belge            (id, bağlı_kayıt, dosya_yolu, tür, yükleyen, tarih)
Müşteri          (id, ad, tc/vergi_no, iletişim)
SatışSözleşmesi  (id, bölüm_id, müşteri_id, tarih, liste_fiyatı, indirim, satış_fiyatı,
                  para_birimi, kdv, emlakçı, komisyon)
Taksit           (id, sözleşme_id, vade, tutar, tür[peşinat|taksit|ara|kredi])
Tahsilat         (id, taksit_id, tarih, tutar, yöntem, çek/senet_no)
FiyatlandırmaAyarı(proje_id, kâr_tipi, kâr_oranı, komisyon, yuvarlama, kullanım_tipi_oranları)
Katsayı          (proje_id, tür[kat|cephe|manzara|tip], değer_anahtarı, katsayı)
Senaryo          (id, proje_id, ad, değişen_parametreler)
VergiHarçParametresi (yıl, belediye, tür, oran/tutar)
DeğişiklikGeçmişi(tablo, kayıt_id, alan, eski, yeni, kullanıcı, zaman)
```

Şablon proje: yeni proje açılırken varsayılan İKY ağacı, reçeteler ve parametrik katsayılar
kopyalanır (fiyat katsayıları boş gelir).

---

## 13. Teknoloji

| Katman | Seçim | Neden |
|---|---|---|
| Uygulama tipi | **Web uygulaması + PWA**, sunucuda (bulut) çalışır | Ofis + şantiyeden telefonla erişim, kurulum gerektirmez |
| Ön yüz | React + TypeScript (Next.js), Tailwind + shadcn/ui | Hızlı, modern, mobil uyumlu Türkçe arayüz |
| Tablo bileşeni | TanStack Table / AG Grid | Excel benzeri hızlı veri girişi |
| Veritabanı | **PostgreSQL** (Prisma ORM) — ilk günden | Çok kullanıcılı, eşzamanlı erişim |
| Kimlik / yetki | E-posta + şifre girişi, rol ve proje bazlı yetki | Şantiye/satış/muhasebe ayrımı |
| Dosyalar | S3 uyumlu bulut depolama (fatura/fiş görselleri) | Telefon fotoğrafları için |
| Hesap motoru | Ayrı, saf TypeScript modülü + birim testleri | Hesapların doğruluğu test ile güvence altında |
| Raporlar | Excel (ExcelJS), PDF | Muhasebeci, banka, satış ekibi |
| Kurlar | TCMB günlük kur servisinden otomatik çekme | Döviz bazlı alımlar |
| Para hesapları | Decimal (kayan nokta değil) | Yuvarlama hatalarını önler |
| Barındırma | Yönetilen bulut veya VPS; günlük otomatik yedek | Erişilebilirlik ve veri güvenliği |

> Müşteri kişisel verileri (satış modülü) nedeniyle KVKK gereği erişim yetkiyle sınırlanır,
> değişiklik geçmişi tutulur; sunucu konumu kurulumdan önce kararlaştırılır.

---

## 14. Yol Haritası (Fazlar)

Öncelik **harcama girişi** olduğu için sıralama buna göre düzenlendi.

| Faz | Kapsam | Çıktı |
|---|---|---|
| **0 – Altyapı** | Proje iskeleti, PostgreSQL şeması, kullanıcı girişi ve proje bazlı roller, test sunucusuna kurulum, varsayılan İKY ağacı, **çoklu proje: proje sekmeleri, "+ Yeni proje", proje listesi, portföy paneli iskeleti**, basit proje/blok kaydı | Ekip giriş yapar, projeler arasında sekmelerle geçer |
| **1 – Harcama girişi** ⭐ | Mobil hızlı giriş + fotoğraf, ofis tablo modu, onay akışı, tedarikçiler, döviz/kur, Excel fatura içe aktarma, harcama raporları, vade listesi, muhasebeci Excel paketi, faturanın projelere bölünmesi, bağlantı avans ödemelerinin harcama olarak girilebilmesi | **İlk kullanılabilir sürüm: devam eden inşaatta kullanıma başlanır** |
| **2 – Satın alma: bağlantılar & taşeron** | **Malzeme bağlantıları** (kalemler, proje tahsisi / atanmamış havuz, çekişler, bakiye, ödeme planı, avans bakiyesi, fatura eşleştirme, uyarılar), Faz 1'de girilen avansların bağlantılara bağlanması, projeler arası malzeme transferi, taşeron sözleşmeleri, hakediş, kesintiler | Bağlantılar ve taşeron ödemeleri programdan izlenir |
| **3 – Bina & bütçe** | Bağımsız bölümler, arsa modeli/sahipleri, kaynak kütüphanesi (faturalardan beslenen), reçeteler, metraj → bütçe, m² maliyeti | Toplam maliyet ve m² maliyeti |
| **4 – Bütçe vs gerçekleşen** | Sapma raporları, EAC, gerçekleşen katsayılar, bağlantı kapsama analizi ve bağlantı kazancı raporu | Maliyet kontrolü |
| **5 – Fiyatlandırma** | Reklam/komisyon dağıtımı, iki kâr yöntemi, kullanım tipine göre baz fiyat, katsayılar, normalizasyon, fiyat kilitleme | **Bölüm fiyat listesi (Excel/PDF)** |
| **6 – Satış & tahsilat** | Müşteri, rezervasyon, sözleşme, ödeme planı, tahsilat, gecikme uyarıları | Satış ekibi programı kullanır |
| **7 – Nakit & senaryo** | İş programı, nakit akışı (harcama + tahsilat + bağlantı ödemeleri), şirket geneli konsolide nakit, projeler arası karşılaştırma, enflasyon/kur, finansman, senaryolar | Fizibilite ve portföy raporları |
| **8 – İyileştirmeler** | e-Fatura XML içe aktarma, çevrimdışı mod, bildirimler, kat planı görünümü | |

Her faz sonunda çalışan bir sürüm teslim edilir ve gerçek kullanımdan gelen geri bildirimle
bir sonraki faz netleştirilir.

---

## 15. Kalite ve Doğrulama

- Hesap motoru için birim testleri (örnek projeyle elle hesaplanmış sonuçların karşılaştırılması).
- Bölüm 7.7'deki örnek proje test verisi olarak kullanılacak.
- Alan tutarlılık kontrolleri: bölüm m² toplamı ↔ inşaat alanı, arsa sahibi payı ↔ işaretli bölümler.
- Döviz çevrimleri ve KDV hesapları için ayrı testler.
- Bağlantı bakiyesi (toplam = çekilen + kalan), tahsislerin bağlantı miktarını aşmaması ve
  projelere bölünen faturalarda dağılım toplamının %100 olması kontrolleri.
- Proje ayrımı testi: bir projenin kaydı başka projenin raporuna/yetkisiz kullanıcıya görünmez.
- Her rakamın kaynağı izlenebilir (hangi metraj, hangi fiyat, hangi tarih, hangi kur).
- Otomatik günlük yedekleme ve değişiklik geçmişi (kim neyi ne zaman değiştirdi).
- Mobil girişin şantiye koşullarında (zayıf internet, küçük ekran) test edilmesi.

---

## 16. Alınan Kararlar

| Konu | Karar | Plana etkisi |
|---|---|---|
| Kullanıcılar | Ekip + şantiyeden telefonla erişim | Bulutta web uygulaması + PWA, roller ve proje bazlı yetki, PostgreSQL ilk günden |
| Proje tipleri | Apartman, villa, ticari, çok bloklu site | Kullanım tipi (konut/dükkân/ofis), blok bazlı ve ortak maliyet dağıtımı |
| Arsa modeli | Kat karşılığı ve satın alma (ikisi de) | Proje bazında arsa modeli seçimi, karma model desteği |
| Taşeron yapısı | İşe göre karışık | Her kalemde temin şekli: malzemeli taşeron / malzeme bizden / kendi ekip |
| Mevcut veri | Sadece fatura kayıtları | Fatura içe aktarma öncelikli; fiyat kütüphanesi faturalardan beslenir |
| Muhasebe | Dış muhasebeci tutuyor | Entegrasyon yok; dönemsel Excel muhasebeci paketi |
| Para birimi | TL + döviz | Kur tablosu (TCMB), işlem kuru, kur senaryosu |
| Kâr yöntemi | İkisini de göster | Marj ve maliyet üzerine ekleme birlikte, proje bazında seçim |
| Satış takibi | Satış + taksit takibi | Ayrı modül (Bölüm 10), nakit akışına bağlı |
| Fiyat katsayıları | Ekip belirler | Tablolar boş gelir, önceki projeden kopyalama |
| İlk sürüm önceliği | Önce harcama girişi | Yol haritası: Faz 1 = harcama girişi |
| Çoklu proje | Aynı anda birden fazla proje, her biri ayrı sekmede | Proje sekmeleri, portföy paneli, şirket geneli ortak kütüphane/tedarikçi, konsolide raporlar (Bölüm 5.1), Faz 0'da kurulur |
| Malzeme bağlantıları | Proje başlamadan yapılan ön satın alımlar tutulacak | Bağlantı modülü: proje tahsisi, çekiş, bakiye, avans, bütçe fiyatı (Bölüm 9), Faz 2 |

### Faz 0 sırasında netleşecek küçük konular
- Barındırma tercihi (sunucu yeri, alan adı) ve kullanıcı listesi (kimler, hangi roller).
- Devam eden projenin temel bilgileri (ad, bloklar) ve mevcut fatura kayıtlarının formatı
  (Excel mi, e-Fatura XML mi, kâğıt mı) — içe aktarma aracı buna göre şekillenecek.
- Şantiyede internet durumu (çevrimdışı mod önceliğini belirler).
