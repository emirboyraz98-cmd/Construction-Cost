# İnşaat Maliyet

İnşaat şirketi için maliyet, fiyatlandırma, harcama, bağlantı ve satış takip programı.
Kapsam ve yol haritası: [PLAN.md](PLAN.md).

**Durum: Faz 8 – İyileştirmeler (PLAN'daki tüm fazlar tamamlandı).**

- **Faz 0 (altyapı):** kullanıcı girişi ve roller, proje bazlı yetki, proje sekmeleri, yeni proje
  sihirbazı, portföy ve proje paneli, bloklar ve maliyet ağacı (İKY).
- **Faz 1 (harcama):** telefondan fotoğraflı hızlı giriş, ofiste tablo / Excel ile toplu giriş,
  onay akışı, tedarikçiler, döviz kurları (TCMB), vade listesi, harcama raporları,
  ortak faturanın projelere bölünmesi, avans kaydı ve muhasebeci paketi.
- **Faz 2 (satın alma):** malzeme bağlantıları (kalemler, proje tahsisi / atanmamış havuz, çekişler,
  bakiye, ödeme planı, avans bakiyesi, fatura eşleştirme, uyarılar), avansların bağlantıya /
  sözleşmeye bağlanması, projeler arası malzeme transferi, taşeron sözleşmeleri, hakediş ve kesintiler.
- **Faz 3 (bina ve bütçe):** bağımsız bölümler, arsa sahipleri ve pay kontrolü, malzeme / fiyat
  kütüphanesi (faturalardan beslenen), reçeteler, üç seviyeli metraj, bütçe, toplam ve m² maliyeti.
- **Faz 4 (bütçe kontrolü):** baz bütçe (dondurma), bütçe – gerçekleşen – tahmini tamamlanma
  maliyeti (EAC) ve sapma, aşım / risk uyarıları, gerçekleşen katsayılar, bağlantı kapsaması ve
  bağlantı kazancı, Excel çıktısı.
- **Faz 5 (fiyatlandırma):** reklam ve komisyon payı, iki kâr yöntemi (marj / maliyet üzerine),
  kullanım tipine göre baz fiyat, kat / cephe / manzara / tip katsayıları, normalizasyon, yuvarlama,
  satış KDV'si, fiyat kilidi, onaylı fiyat listesi sürümleri, Excel ve PDF (yazdır) fiyat listesi.
- **Faz 6 (satış ve tahsilat):** müşteriler, süreli rezervasyon, satış sözleşmesi (indirim, KDV,
  döviz, emlakçı komisyonu), ödeme planı (peşinat, taksit, ara ödeme, anahtar teslim, kredi),
  tahsilat ve kısmi ödeme, çek / senet takibi, geciken ve yaklaşan taksitler, teslim tarihi.
- **Faz 7 (nakit ve senaryo):** iş programı (basit Gantt), aylık nakit akışı (harcama, hakediş,
  bağlantı ödemeleri, kalan maliyet, tahsilat, taksit, satış varsayımı), enflasyon / kur / finansman
  maliyeti, senaryolar ve duyarlılık, kâra en çok etki eden kalemler, şirket geneli konsolide nakit,
  projeler arası karşılaştırma.
- **Faz 8 (iyileştirmeler):** e-Fatura / e-Arşiv XML (ve ZIP) içe aktarma, çevrimdışı harcama girişi,
  bildirim merkezi, kat planı görünümü (satış durumu ve sahiplik).

Menüde henüz yapılmayan ekranlar **“Yakında”** olarak görünür.

---

## Bilgisayarda kurulum ve çalıştırma (Windows)

Program şimdilik bir bilgisayarda çalışır; aynı Wi-Fi'daki telefonlar da bağlanabilir.
Veritabanı kurmanız gerekmez, program kendi veritabanını klasörün içinde çalıştırır.

### 1. Bir kez yapılacaklar

1. **Node.js** (LTS sürümü, 22.12 veya üstü) ve **Git** kurun: nodejs.org ve git-scm.com.
2. Türkçe karakter ve boşluk içermeyen bir klasörde (ör. `C:\projeler`) komut istemini açıp
   programı indirin:

   ```bash
   git clone -b claude/bold-hamilton-pfaqe3 https://github.com/emirboyraz98-cmd/Construction-Cost.git
   ```

   Geliştirme şu an bu dalda; PR `main`'e birleştirildikten sonra `-b ...` kısmı gerekmez.

### 2. Çalıştırma: çift tıklama

| Dosya | Ne yapar |
|---|---|
| **`baslat.bat`** | Programı açar. İlk seferde gerekli paketleri indirir ve programı derler (birkaç dakika). Hazır olunca tarayıcı kendiliğinden açılır. |
| **`demo.bat`** | Örnek verili deneme. Ayrı bir **demo veritabanına** dolu bir proje yükler: bölümler, harcamalar, bağlantı, taşeron hakedişi, kütüphane, bütçe. Gerçek verilerinize dokunmaz. |
| **`guncelle.bat`** | GitHub'dan son sürümü alır, paketleri günceller ve programı yeniden derler. Sonra `baslat.bat` ile açın. |
| **`yedekle.bat`** | Hemen bir yedek alır (`yedekler/` klasörüne). Program açıkken de çalışır. |
| **`geri-yukle.bat`** | Seçtiğiniz yedeği geri yükler. **Önce programı kapatın.** |

- Kapatmak için siyah pencerede **Ctrl + C**, sonra pencereyi kapatın. Veritabanı düzgünce kapanır.
- `baslat.bat` ve `demo.bat` aynı anda açılmaz (ikisi de 3000 portunu kullanır). Program zaten açıksa
  `baslat.bat` ikinci kez başlatmaz, yalnızca tarayıcıyı açar.
- Program klasörünü **`C:\insaat`** gibi Türkçe karakter ve boşluk içermeyen bir yere koyun
  (gömülü veritabanı bu tür yollarda sorun çıkarabilir).
- Komut satırını tercih ederseniz: `npm run baslat`, `npm run demo`, `npm run guncelle`.

### Varsayılan giriş

| E-posta | Şifre |
|---|---|
| `yonetici@insaat.local` | `Yonetici.2026` |

Bu bir **test hesabıdır**. Giriş yaptıktan sonra sağ üstteki kullanıcı menüsünden
**Hesabım / şifre değiştir** ile şifrenizi değiştirin. Diğer çalışanları
**Ayarlar → Kullanıcılar** ekranından ekleyip rol ve proje yetkisi verin.

Demoda ayrıca `muhasebe@demo.local`, `sef@demo.local`, `satinalma@demo.local` kullanıcıları
vardır (şifre `Demo.2026`). Rolleri denemek için bunlarla giriş yapın: örneğin şantiye şefi
fiyatları ve bütçeyi görmez.

İlk yönetici hesabı veritabanında hiç kullanıcı yokken bir kez oluşturulur. Farklı bir
e-posta/şifre ile başlamak isterseniz `.env.example` dosyasını `.env` adıyla kopyalayıp
`SEED_ADMIN_*` değerlerini **ilk çalıştırmadan önce** değiştirin.

### Telefondan kullanma (aynı Wi-Fi ağında)

`baslat.bat` açıldığında pencerede “Aynı Wi-Fi'daki telefondan: http://192.168…:3000” gibi
bir adres yazar; telefonda bu adresi açın. Windows Güvenlik Duvarı izin isterse
“Özel ağlar” için izin verin. Telefona uygulama gibi eklemek için aşağıdaki bölüme bakın.
Telefonun ana ekrana ekleme özelliği HTTPS ister. Yerel ağda bu özellik çalışmayabilir;
program yine tarayıcıdan kullanılır.

### Verileriniz nerede?

- **`.pgdata`** klasörü: veritabanı (gerçek veriler ve ayrıca demo veritabanı).
- **`uploads`** klasörü: fiş / fatura fotoğrafları ve PDF'ler.
- **Yedek:** Program her açılışta (ve açık kaldığı sürece günde bir) **otomatik yedek** alır → `yedekler/` klasörü. Ayrıntı: aşağıda “Yedek ve geri yükleme”.
  Bu klasörleri silmek bütün verileri siler.
- İleride sunucuya (online) geçildiğinde veriler bu klasörlerden taşınır.

---

## Harcama girişi: kim ne yapar?

| İş | Nerede | Kim |
|---|---|---|
| Fiş / fatura girişi (telefondan) | Proje → **Harcamalar → Harcama gir** | Şantiye şefi, satın alma, muhasebe, yönetici |
| Çok sayıda faturayı bir kerede girme (ofiste) | Proje → **Harcamalar → Toplu giriş / Excel** | Harcama girebilen herkes |
| Onaylama / reddetme | Proje → **Harcamalar** (filtre: *Onay bekliyor*) | Muhasebe, yönetici |
| Birden fazla projeye gelen tek fatura | Şirket geneli → **Ortak fatura** | Muhasebe, yönetici |
| Ödenecekler ve ödendi işareti | Şirket geneli → **Vade listesi** | Görme: raporları görenler · işaretleme: muhasebe, yönetici |
| Kalem / ay / tedarikçi / blok raporu | Proje → **Raporlar** | Yönetici, teknik ofis, muhasebe, satın alma, dış muhasebeci |
| Dış muhasebeciye dönem paketi | Şirket geneli → **Muhasebeci paketi** | Muhasebe, yönetici, dış muhasebeci |
| Döviz kurları, KDV oranları | **Ayarlar** | Muhasebe, yönetici |
| Malzeme bağlantısı açma, tahsis, ödeme planı, fatura | Şirket geneli → **Bağlantılar** | Yönetici, muhasebe, satın alma |
| “Malzeme geldi” (bağlantıdan çekiş) | Proje → **Harcamalar → Malzeme geldi** | Harcama girebilen herkes |
| Taşeron sözleşmesi | Proje → **Taşeron & hakediş** | Yönetici, teknik ofis, muhasebe, satın alma |
| Hakediş hazırlama (kümülatif metraj) | Sözleşme → **Hakediş hazırla** | Şantiye şefi, teknik ofis, muhasebe, yönetici |
| Hakediş onayı | Hakediş sayfası | Muhasebe, yönetici |
| Projeler arası malzeme transferi | Şirket geneli → **Malzeme transferi** | Yönetici, muhasebe, satın alma (iki projede de) |
| Bağımsız bölümler, arsa sahipleri | Proje → **Bağımsız bölümler**, **Arsa & sözleşme** | Düzenleme: yönetici, teknik ofis · görme: projedeki herkes |
| Malzeme / fiyat kütüphanesi, reçeteler | Şirket geneli → **Kütüphane** | Yönetici, teknik ofis, muhasebe, satın alma |
| Metraj ve bütçe | Proje → **Metraj**, **Bütçe** | Düzenleme: yönetici, teknik ofis · görme: + muhasebe, satın alma, dış muhasebeci |
| Baz bütçe, tamamlanma yüzdesi, sapma | Proje → **Bütçe kontrolü** | Düzenleme: yönetici, teknik ofis · görme: + muhasebe, satın alma, dış muhasebeci |
| Fiyatlandırma ayarları ve katsayılar | Proje → **Fiyatlandırma** | Düzenleme: yönetici, teknik ofis · görme: + muhasebe, dış muhasebeci |
| Fiyat listesi onayı, fiyat kilidi | Proje → **Fiyatlandırma** | Yönetici |
| Onaylı fiyat listesi (maliyetsiz) | Proje → **Fiyatlandırma** | + satış ekibi |
| Müşteri, rezervasyon, satış, ödeme planı, teslim | Proje → **Satışlar** | Yönetici, muhasebe, satış · görme: + dış muhasebeci |
| Tahsilat girişi, çek / senet durumu | Proje → **Tahsilatlar** veya sözleşme sayfası | Yönetici, muhasebe, satış |
| Nakit akışı, iş programı, varsayımlar | Proje → **Nakit akışı** | Düzenleme: yönetici, teknik ofis, muhasebe · görme: + dış muhasebeci |
| Senaryolar | Proje → **Senaryolar** | Düzenleme: yönetici, teknik ofis · görme: + muhasebe, dış muhasebeci |
| Konsolide nakit, genel merkez gideri | Şirket geneli → **Konsolide nakit** | Düzenleme: yönetici, muhasebe · görme: + dış muhasebeci |
| Projeler arası karşılaştırma | Şirket geneli → **Projeler arası raporlar** | Yönetici, teknik ofis, muhasebe, dış muhasebeci |

- **Onay akışı:** Şantiye şefinin ve satın almanın girdiği kayıtlar *Onay bekliyor* olarak düşer;
  muhasebe veya yönetici onaylar ya da nedenini yazarak reddeder. Reddedilen kaydı giren kişi
  düzeltince kayıt yeniden onaya gelir. Muhasebe ve yöneticinin girdiği kayıtlar doğrudan onaylıdır.
  Maliyet toplamlarında yalnızca **onaylı** kayıtlar sayılır.
- **Şantiye şefi** yalnızca kendi girdiği kayıtları görür (*Son girişlerim*); proje toplamlarını görmez.
- **Avans:** “Avans” türündeki kayıtlar ödeme olarak izlenir, maliyete eklenmez
  (Faz 2'de malzeme bağlantılarına bağlanacak).
- **Döviz:** Döviz cinsinden faturada tarih seçilince o günün (yoksa önceki iş gününün) TCMB
  **döviz alış** kuru önerilir; kur elle değiştirilebilir. TCMB'den kur çekmek için internet gerekir;
  kurlar **Ayarlar → Döviz kurları** ekranından elle de girilebilir.
- **KDV oranları** (%20, %10, %1, %0) programa gömülü değildir; **Ayarlar → Vergi, harç ve oran
  parametreleri** ekranından yıl bazında değiştirilebilir. Başlangıç değerlerini muhasebecinizle teyit edin.
- **Muhasebeci paketi:** Seçilen dönemin onaylı harcamaları Excel olarak (fatura, avans ve tedarikçi
  özeti sayfaları) ve fiş/fatura görselleri tek bir ZIP dosyasında iner.

### Bağlantılar ve taşeron: nasıl çalışır?

- **Bağlantı** (ör. 1.000 m³ hazır beton, 3.200 TL/m³): kalemler, ödeme planı ve sözleşme belgesi
  girilir. **Tahsis** ile miktar projelere paylaştırılır; kalan kısım “atanmamış – şirket geneli”
  havuzda bekler. Payı bir projeden diğerine aktarmak için tahsis yeniden düzenlenir; geçmişi tutulur.
- **Çekiş:** Şantiye “Malzeme geldi” ile irsaliye ve fotoğrafı girer. Çekiş önce projenin payından,
  yetmezse havuzdan düşer; bağlantıda kalmayan miktar girilemez. **Maliyet ödemede değil çekişte
  oluşur** ve projeye bağlantı fiyatıyla yazılır. Şantiye şefi fiyatı görmez; ofis onaylar.
- **Avans bakiyesi** = ödenen (ödeme planı + bağlı avanslar) − teslim alınan malzeme (KDV dahil).
- **Fatura eşleştirme:** Bağlantıya eklenen tedarikçi faturası maliyete tekrar yazılmaz; birim fiyat
  ve teslim alınan miktarla karşılaştırılır, fark varsa uyarı verir. Muhasebeci paketine girer.
- **Uyarılar:** son çekiş / geçerlilik / sabit fiyat tarihi yaklaşan, kalanı %10'un altına düşen,
  ödemesi geciken veya 7 gün içinde olan, çekilmemiş avansı olan ve faturası farklı bağlantılar.
  Portföyde ve bağlantı listesinde görünür.
- **Hakediş:** Kümülatif miktar girilir; bu dönem = kümülatif − önceki hakedişler. Brüt → KDV →
  KDV tevkifatı, teminat, avans mahsubu, malzeme mahsubu ve diğer kesintiler → **net ödeme**.
  Oranlar sözleşmeye girilir (programda sabit oran yoktur). Onaylanınca brüt (malzeme mahsubu
  düşülerek) maliyete yazılır, net ödeme vade listesine girer. Son hakedişin onayı ödenmemişse geri alınabilir.
- **Vade listesi** artık harcama/avanslarla birlikte bağlantı ödeme planını ve hakediş net ödemelerini de gösterir.

### Bina ve bütçe: nasıl çalışır?

- **Bağımsız bölümler:** Her blokta “Kat kat üret” ile aynı tipteki bölümler bir seferde açılır,
  sonra tek tek düzenlenir. Arsa sahibine verilecek bölümler seçilip toplu işaretlenir. Program,
  sözleşmedeki pay ile işaretlenen bölümlerin brüt m² oranını karşılaştırır (0,5 puandan fazla fark
  kırmızı uyarı) ve blokların bölüm alanlarını blok inşaat alanıyla kıyaslar.
- **Kütüphane:** Malzeme, işçilik, makine ve hizmetler. Bütçede kullanılan fiyatın önceliği:
  **geçerli bağlantı fiyatı → son alım (fatura) → teklif → piyasa araştırması**.
  - Bağlantı kalemine kütüphane malzemesi seçilirse aktif bağlantı fiyatı öncelikli olur.
  - **Faturalardan fiyat:** birim fiyatı girilmiş fatura satırları malzemeyle eşleştirilir; aynı
    açıklamalı satırlar sonraki sefer otomatik önerilir (“Öğrenilenleri uygula”).
  - Dövizli fiyatlar son kayıtlı kurla TL'ye çevrilir.
- **Reçete:** 1 birim iş için kaynak miktarları (ör. 1 m² seramik = seramik + yapıştırıcı + derz +
  ustalık). Fire kaynağın kendi oranından eklenir. Fiyat değişince reçete ve onu kullanan bütçe
  satırları kendiliğinden güncellenir.
- **Metraj:** Her bütçe satırında miktar üç yoldan biriyle girilir: **parametrik** (alan ×
  katsayı), **formül** (ör. `net_alan * 0,9`) veya **manuel**. Parametrik katsayıların başlangıç
  değerleri PLAN 6'daki aralıkların ortasıdır (beton 0,42 m³/m², demir 42 kg/m², kalıp 3 m²/m²,
  iç sıva ve boya 2,75 m²/m² net) — yalnızca başlangıç varsayımıdır, projeye göre düzenleyin.
  Metraj ekranı, onaylı harcama miktarlarından **gerçekleşen katsayıyı** da gösterir.
- **Bütçe:** Kalem maliyeti = miktar × birim fiyat × (1 + fire). Bloğa ait olmayan satırlar bloklara
  inşaat alanı oranında dağıtılır.
  - **İnşaat m² maliyeti** = yapım maliyeti (04–12) / toplam inşaat alanı.
  - **Müteahhit satılabilir m² maliyeti** = toplam maliyet / müteahhide kalan brüt m². Kat
    karşılığında arsa sahibinin bölümlerinin maliyeti de müteahhide aittir (PLAN 7.3).
- **Excel'den metraj:** Bütçe → **Excel'den aktar**. Metraj cetveli / keşif listesi (Excel, CSV veya
  yapıştırma) toplu eklenir: kalem kodu veya adı, metraj, birim, birim fiyat, blok. Kod bulunamayan
  satırlar işaretlenir ve eklenmez; fiyatı olmayan satırın fiyatı sonra bütçe ekranında girilir.
- **Arsa ödemeleri:** Arsa & sözleşme ekranında 01 grubundaki ödemeler vade sırasıyla listelenir. Arsa
  satın alınan (veya karma) projede taksit buradan eklenir; vade listesine ve nakit akışına yansır.
- **Maliyet ağacı şablonu:** Ayarlar → Maliyet ağacı şablonu. Yeni projeler bu ağaçla açılır; mevcut
  projeler etkilenmez.

### Bütçe kontrolü: nasıl çalışır?

- **Baz bütçe:** “Bütçeyi dondur” güncel bütçeyi o günün fiyat ve miktarlarıyla saklar. Sapma bu
  referansa göre izlenir; güncel bütçe fiyat ve metraj değiştikçe değişmeye devam eder. Birden çok
  baz bütçe saklanabilir (ör. ilk onay, revizyon). Baz bütçe yoksa güncel bütçe referans alınır.
- **Tamamlanma:** Kalem için elle yüzde girilebilir (ör. “3. kat döşemesi bitti, %35”). Girilmezse
  bütçe ve harcama birimi aynıysa miktardan hesaplanır (gerçekleşen miktar / bütçe miktarı).
- **Tahmini tamamlanma maliyeti (EAC)** = gerçekleşen + güncel bütçe × (1 − tamamlanma).
  Tamamlanma bilinmiyorsa EAC = gerçekleşen ile bütçeden büyük olanı.
  **Sapma** = referans bütçe − EAC (eksi değer aşım demektir).
- **Durumlar:** *Aşıldı* (gerçekleşen bütçeyi geçti), *Aşım bekleniyor* (EAC bütçeyi %5'ten fazla
  geçiyor), *Bütçesiz* (bütçesi olmayan kalemde harcama var).
- **Bağlantı kapsaması:** Bütçedeki malzeme ihtiyacı, projeye tahsis edilen bağlantı miktarıyla
  karşılaştırılır (kütüphane malzemesi ve birim aynıysa). %100'ün altı “açık”, %110'un üstü “fazla”.
- **Bağlantı kazancı** = (güncel fiyat − bağlantı fiyatı) × bağlantı miktarı. Güncel fiyat
  kütüphaneden alınır (son fatura → teklif → piyasa); bağlantı fiyatı hesaba katılmaz.
  Bağlantı sayfasında görünür.
- **Gerçekleşen katsayı:** Metraj ekranı, bu projenin ve diğer projelerin onaylı harcamalarından
  çıkan katsayıyı gösterir; “Gerçekleşen değeri kullan” ile yeni projenin katsayısına aktarılabilir.
- Ekran **Excel** olarak indirilebilir.

### Fiyatlandırma: nasıl çalışır?

- **Maliyet tabanı:** güncel bütçe, tahmini tamamlanma maliyeti (EAC) veya elle girilen tutar
  (fizibilite). Bütçenin 14 grubu (pazarlama) maliyetten ayrılır: sabit reklam bütçesi olarak
  kullanılır (14.06 komisyon hariç); istenirse reklam bütçesi elle girilir.
- **Baz m² fiyatı** (KDV hariç, PLAN 7.5):
  - Satış üzerinden marj: (m² maliyeti + reklam m² payı) / (1 − komisyon − marj)
  - Maliyet üzerine ekleme: (m² maliyeti + reklam m² payı) × (1 + kâr) / (1 − komisyon)
  - m² = müteahhide kalan satılabilir brüt m². Ekranda diğer yöntemin karşılığı ve başabaş fiyatı
    da görünür. Karşılık komisyon dahil hesaplanır (ör. %2 komisyonla %25 marj = maliyet üzerine %34,25).
- **Bölüm fiyatı** = baz m² × kullanım tipi oranı × (brüt m² + bahçe/teras × oran) × kat × cephe ×
  manzara × tip katsayısı. Katsayılar 1,00 başlar; ekip doldurur ya da önceki projeden kopyalar.
  Sonra toplam, hedef gelire eşitlenir (normalizasyon) ve yuvarlama adımına göre yuvarlanır.
- **KDV:** oranlar Ayarlar → Parametreler'den gelir (satış KDV – konut indirimli oran, net alan
  sınırı, genel oran). Başlangıç değerleri net 150 m²'ye kadar konutta %10, diğerlerinde %20'dir;
  ruhsat tarihi, kentsel dönüşüm ve arsa değerine göre farklı olabilir — **muhasebecinizle teyit
  edin**. Bölüm bazında elle oran girilebilir.
- **Onay ve kilit:** Yönetici “Fiyat listesini onayla” deyince liste sürüm olarak saklanır ve
  bölümlerin liste fiyatı güncellenir; satış ekibi yalnızca bu listeyi görür. Kilitli (ör. satılmış)
  bölümlerin fiyatı değişmez; maliyet veya kâr değişince hedef gelirin kalanı diğer bölümlere dağılır
  ve onaylı listeye göre gereken artış gösterilir.
- **Çıktılar:** Excel ve yazdırılabilir sayfa (tarayıcıda “PDF olarak kaydet”). Taslak çıktı yalnızca
  maliyet görebilenlere açıktır.

### Satış ve tahsilat: nasıl çalışır?

- **Bölüm durumu:** Boş → Rezerve → Satıldı; arsa sahibi bölümleri satışa kapalıdır (teslim
  tarihi takip edilir). Satışlar ekranında durum filtresi, satış ve tahsilat özeti ile hedef gelire
  göre durum (satılanların gerçek fiyatı + boşların liste fiyatı ↔ onaylı listenin hedef geliri) görünür.
- **Müşteri:** projeye bağlıdır. Kimlik ve iletişim bilgilerini yalnızca yönetici, muhasebe, satış
  ve dış muhasebeci görür (KVKK). Satış veya rezervasyon sırasında listeden seçilir ya da yeni açılır.
- **Rezervasyon:** başlangıç ve bitiş tarihi, kapora, teklif fiyatı. Bitiş günü geçince kendiliğinden
  düşer; “Satışa dönüştür” ile satış formu müşteri ve fiyatla dolu açılır.
- **Satış sözleşmesi:** liste fiyatı (onaylı listeden), indirim, satış fiyatı, KDV (listedeki oran),
  TL veya döviz (sözleşme kuru), emlakçı ve komisyon (fiyatlandırmadaki yüzdeyle önerilir).
  Kaydedilince bölümün fiyatı kilitlenir; fiyatlandırmada **gerçek satış fiyatı** kullanılır ve
  hedefe ulaşmak için kalan bölümlerin ne kadar artması gerektiği görünür. Satılmış bölümün kilidi
  açılamaz; satış iptal edilince bölüm yeniden satışa açılır.
- **Ödeme planı:** “Planı oluştur” peşinat, anahtar teslim ve kredi düşüldükten sonra kalanı eşit
  taksitlere böler (kuruş farkı son taksitte); satırlar elle düzenlenebilir, ara ödeme eklenebilir.
  Plan toplamı KDV dahil satış tutarına eşit olmalıdır.
- **Tahsilat:** en eski vadeli taksitten başlayarak dağıtılır (kısmi ödeme olur). Çek / senet
  “portföyde” kaydedilir; **tahsil edildi** işaretlenince tahsilata sayılır, karşılıksız çıkarsa
  sayılmaz. Çekle karşılanan taksit gecikmiş sayılmaz (“çek / senette”), kalan alacak ise çek tahsil
  edilene kadar düşmez.
- **Tahsilatlar ekranı:** geciken taksitler (gün sayısıyla), 30 gün içinde vadesi gelenler,
  portföydeki çek / senetler ve son tahsilatlar; taksit takvimi ve tahsilatlar Excel olarak iner.
  Portföy ve proje kartlarında satış, tahsilat ve geciken taksit sayısı görünür.

### Nakit akışı ve senaryolar: nasıl çalışır?

- **İş programı** (Nakit akışı → İş programı): her maliyet kalemi için başlangıç ve bitiş ayı (1 =
  proje başlangıç ayı). Programı olmayan kalem üst kaleminin, o da yoksa tüm projenin aralığını
  kullanır. “Varsayılan program öner” ana gruplara tipik konut sırasına göre süreye oranlı aralık
  yazar (yalnızca başlangıç varsayımı).
- **Nakit akışı** (KDV dahil, aylık):
  - Çıkış: harcama ve avanslar (ödendiyse ödeme tarihinde, değilse vadesinde), onaylı hakedişlerin
    net ödemesi, bağlantı ödeme planı (projeye tahsis payı oranında) ve **kalan maliyet**.
  - Kalan maliyet = tahmini tamamlanma maliyeti (EAC) − gerçekleşen − bağlantıyla sabitlenmiş açık
    miktar; iş programındaki aylara eşit yayılır, KDV eklenir.
  - Giriş: tahsilatlar, kalan taksitler, portföydeki çekler (vadesinde) ve satılmamış bölümler için
    satış varsayımı (ayda kaç bölüm, peşinat, taksit sayısı; liste fiyatıyla).
  - Vadesi geçmiş ödenmemiş kalemler bu aya yazılır.
  - Varsayımlar: başlangıç nakdi, aylık maliyet artışı (bileşik), kur değişimi (dövizli bütçe
    satırları, ödemeler ve tahsilatlar), aylık finansman maliyeti (kümülatif açığa).
  - Ekranda en yüksek nakit ihtiyacı ve ayı, finansman maliyeti, dönem sonu bakiye ve beklenen kâr
    (KDV hariç, finansman dahil) görünür; Excel olarak iner.
- **Senaryolar:** kalem bazında fiyat değişimi (kod öneki: 05.05 demir, 05 tüm kaba inşaat), kur,
  aylık artış, finansman, gecikme (ay), satış fiyatı ve hızı, arsa payı. Her senaryo için maliyet,
  gelir, finansman, kâr, hedef kâr için gereken baz m² fiyatı ve en yüksek nakit ihtiyacı baza göre
  gösterilir. PLAN 7.9'daki dört duyarlılık örneği (demir +%15, döviz +%20, 3 ay gecikme, arsa payı
  %50) hazır gelir. Senaryolar kopyalanabilir.
  - Fiyat değişimleri yalnızca kalan maliyete uygulanır; bağlantıyla sabitlenmiş miktar etkilenmez.
  - Gecikmede şantiye genel giderleri (03) ve kira yardımı (01.03) süreyle orantılı artar; anahtar
    teslim ve banka kredisi tahsilatları ile yeni satışlar o kadar ay ötelenir.
- **Kâra en çok etki eden kalemler:** kalan maliyetin ve satılmamış bölüm fiyatlarının ±%10 değişiminin
  kâra etkisi, büyükten küçüğe.
- **Şirket geneli:** konsolide nakit (projeler + atanmamış bağlantı ödemeleri + aylık genel merkez
  gideri, şirket başlangıç nakdiyle) ve projeler arası karşılaştırma (m² maliyetleri, bütçe / EAC,
  gelir, kâr, nakit ihtiyacı, ortak malzemelerin birim fiyatları).

### İyileştirmeler (Faz 8)

- **e-Fatura / e-Arşiv:** Harcamalar → Toplu giriş → **e-Fatura (XML)**. GİB portalından veya
  entegratörden indirilen XML dosyaları ya da ZIP (birden fazla) seçilir. Her fatura kalemi ayrı satır
  veya fatura başına KDV oranına göre tek satır olarak tabloya gelir: tarih, tedarikçi ve vergi no,
  fatura no, kalem, miktar / birim, birim fiyat, matrah, KDV, vade. Maliyet kalemi tedarikçinin bu
  projede son kullandığı kalemden önerilir; siz kontrol edip “Kontrol et → Aktar” dersiniz. Aynı
  fatura ikinci kez yüklenirse mükerrer olarak işaretlenir; iade, tevkifat ve fatura altı iskonto için
  uyarı verilir. Kayıtlı olmayan tedarikçi vergi numarasıyla açılır.
- **Çevrimdışı giriş:** Şantiyede internet yoksa hızlı harcama girişi kaydı (fotoğraflarıyla) telefona
  yazar; üstte “Çevrimdışı · N” görünür. Bağlantı gelince kayıtlar kendiliğinden gönderilir. Mükerrer
  şüphesi veya hata olursa **Bekleyen kayıtlar** sayfasında “Yine de gönder” / “Sil” seçilir. Hızlı
  giriş sayfası bir kez açıldıysa internetsiz de açılır (son açılıştaki kalem / tedarikçi listesiyle).
  Çıkış yapınca bu sayfa önbelleği silinir. Not: bu özellik yalnızca `baslat.bat` / `npm run start`
  (üretim) ile çalışır, geliştirme modunda (`npm run dev`) devre dışıdır.
- **Bildirimler:** Üstteki zil, rolünüze göre bekleyen işleri gösterir: onay bekleyen harcama ve
  hakedişler, reddedilen kayıtlarınız, vadesi geçen / 7 gün içindeki ödemeler, bağlantı uyarıları,
  geciken taksitler, bitmek üzere olan rezervasyonlar, vadesi gelen çek / senetler. İş tamamlanınca
  listeden kendiliğinden düşer. E-posta / SMS / telefon bildirimi yoktur.
- **Kat planı:** Satışlar ve Bağımsız bölümler ekranlarında **Kat planı** düğmesi: bloklar, üst kattan
  aşağı bölümler. Satışta renk = boş / rezerve / satıldı / arsa sahibi (müşteri, liste fiyatı, geciken
  taksit yazar; tıklayınca sözleşme veya satış formu açılır); bölümler ekranında renk = müteahhit / arsa
  sahibi.

### Yedek ve geri yükleme

- **Otomatik:** `baslat.bat` her açılışta o günün yedeği yoksa yedek alır; program günlerce açık
  kalırsa saatte bir kontrol edip gün değişince yine alır. Yedek = tüm veriler + fiş / fatura
  fotoğrafları, tek ZIP: `yedekler/yedek-2026-10-31_0915.zip`. Son 14 yedek tutulur, eskiler silinir.
- **Elle:** `yedekle.bat` veya programda **Ayarlar → Yedekler → Şimdi yedek al** (oradan indirilebilir).
- **Bilgisayar dışına:** Yedek aynı bilgisayardaysa disk bozulunca o da gider. Program klasöründe
  `.env` adlı bir dosya oluşturup içine şu satırı yazarsanız yedekler OneDrive / Google Drive
  klasörüne alınır (buluta kendiliğinden gider):
  ```
  BACKUP_DIR=C:\Users\KullaniciAdi\OneDrive\InsaatYedek
  ```
- **Geri yükleme:** Programı kapatın (pencerede Ctrl + C), **`geri-yukle.bat`** çalıştırın, listeden
  yedeği seçin ve `EVET` yazın. Önce mevcut durumun yedeği alınır, sonra veriler yedektekiyle değiştirilir.

### Güvenlik

- Aynı e-postayla 15 dakikada 5 hatalı şifre denemesinde giriş 15 dakika kilitlenir (aynı bilgisayardan
  20 denemede de). Kilitlenme değişiklik geçmişine yazılır.
- **Ayarlar → Değişiklik geçmişi** (yönetici): kim, neyi, ne zaman ekledi / değiştirdi / sildi / onayladı.
- Telefondan bağlanırken Windows güvenlik duvarı ilk açılışta izin sorar: **“Özel ağlar”** için izin verin.

### Kullanım kolaylıkları

- **Sade menü:** proje için 6 başlık (Proje paneli, Harcamalar, Bina ve arsa, Bütçe, Satış, Nakit ve rapor),
  şirket için 5 başlık (Portföy, Satın alma, Ödemeler, Şirket raporları, Ayarlar). Alt ekranlar sayfanın üstünde sekmedir.
- **ⓘ açıklamalar:** başlık, özet rakam ve form alanlarının yanındaki ⓘ'ya gelince (telefonda dokununca) kavramın ne olduğu,
  neden önemli olduğu ve örnek hesap açılır. Metinler `src/lib/glossary.ts` dosyasındadır.
- **Basit / gelişmiş görünüm:** varsayılan basit görünümde kısa formlar (isteğe bağlı alanlar “Ayrıntılar” altında) ve
  ana rakamlar görünür. Kullanıcı menüsü → **Gelişmiş görünüm** ile maliyet ağacı, senaryolar, kütüphane, malzeme transferi,
  ortak fatura ve formlardaki formül / reçete / döviz seçenekleri açılır (tarayıcı başına hatırlanır).
- **Proje paneli beş soru:** Ne harcadık? Bütçe ne durumda? Ne sattık? Kasada ne var, ne lazım? Bu hafta ne ödenecek?
- **Hızlı bütçe:** Bütçe → Hızlı bütçe (m² ile): ana gruplara m² başına veya götürü tutar; ayrıntılı metraj sonra eklenir.
- Giriş sonrası: şantiye şefi doğrudan **harcama girişine**, satış ekibi **satışlara** gelir (tek projesi varsa).
- Proje panelinin üstünde role göre büyük düğmeler (Harcama gir, Malzeme geldi, Onay bekleyen, Satış
  yap, Tahsilat gir) ve yeni projede **“Proje kurulumu”** adım listesi.
- Kullanıcı menüsü → **Nasıl kullanılır?**: role göre adım adım kısa kılavuz.
- **Resimli kullanım kılavuzu** (Nasıl kullanılır? → Resimli kılavuz, `/help/guide`): örnek bir projeyi
  (“Örnek – Ataşehir Konutları”) baştan sona kurarak programın tamamı, 42 ekran görüntüsü ve örnek
  hesaplarla. “PDF olarak indir” ile yazdırılabilir. Görseller `public/kilavuz/` klasöründedir.
- **PDF çıktılar** (tarayıcıda “Yazdır → PDF olarak kaydet”): hakediş (imza alanlı), müşteri ödeme
  planı (satış sözleşmesi ekranında “Ödeme planı (PDF)”), fiyat listesi.

### Telefona uygulama gibi ekleme

Telefonda programı açtıktan sonra tarayıcı menüsünden **“Ana ekrana ekle”** (Android / Chrome)
veya **Paylaş → “Ana Ekrana Ekle”** (iPhone / Safari) seçin. Program ana ekranda simgeyle açılır.
Fiş fotoğrafı çekerken telefon kamerası doğrudan açılır; fotoğraflar yüklenmeden önce küçültülür.

---

## Komutlar

| Komut | Ne yapar |
|---|---|
| `npm run baslat` | `baslat.bat` ile aynı: gerekirse kurar, derler ve açar |
| `npm run demo` | `demo.bat` ile aynı: ayrı demo veritabanında örnek verili deneme |
| `npm run guncelle` | `guncelle.bat` ile aynı: son sürümü alır, kurar, derler |
| `npm run dev` | (Geliştirici) Geliştirme modunda başlatır |
| `npm run build` | Üretim için derler |
| `npm start` | Derlenmiş uygulamayı başlatır (önce `npm run build`) |
| `npm test` | Birim testlerini çalıştırır |
| `npm run lint` | Kod denetimi |
| `npm run typecheck` | TypeScript tip denetimi |
| `npm run db:migrate` | (Geliştirici) Şema değişikliğinden yeni migration üretir |
| `npm run db:studio` | (Geliştirici) Veritabanını tarayıcıda görüntüler (Prisma Studio) |

## Veritabanı

- **Varsayılan:** `.pgdata/` klasöründe gömülü PostgreSQL (`embedded-postgres` paketinin
  getirdiği ikili dosyalarla; sisteme kurulum yapılmaz). Port: `5499`.
- **Ayrı bir PostgreSQL** (ör. sunucuda) kullanmak için `.env` dosyasına `DATABASE_URL`
  yazın; bu durumda gömülü veritabanı hiç başlatılmaz.
- **Belge dosyaları** (fiş / fatura fotoğrafları, PDF) `uploads/` klasöründe tutulur.
  Başka bir klasör için `.env` dosyasına `UPLOAD_DIR` yazın.
- **Yedek:** Otomatik günlük yedek `yedekler/` klasörüne alınır (aşağıya bakın); ek olarak program kapalıyken `.pgdata` ve `uploads` klasörlerini birlikte kopyalayabilirsiniz.
  Bu klasörleri silmek **bütün verileri / belgeleri siler**.

## Sorun giderme

| Belirti | Çözüm |
|---|---|
| `5499 portu başka bir program tarafından kullanılıyor` | `.env` dosyasına `EMBEDDED_PG_PORT=5500` gibi başka bir port yazın |
| `Veritabanı çalışıyor görünüyor ama bağlanılamıyor` | Bilgisayarı yeniden başlatın veya `.pgdata\postmaster.pid` dosyasını silin |
| `Veritabanı oluşturulamadı (initdb)` | Proje klasörünü Türkçe karakter/boşluk içermeyen bir yola taşıyın (ör. `C:\projeler`) |
| `Bu bilgisayar için gömülü PostgreSQL bulunamadı` | ARM işlemcili Windows desteklenmiyor; `DATABASE_URL` ile ayrı PostgreSQL kullanın |
| 3000 portu dolu (başka program veya açık bir `baslat`/`demo` penceresi) | Diğer pencereyi kapatın ya da `.env` dosyasına `PORT=3001` yazın |
| `Node.js bulunamadı` | nodejs.org'dan LTS sürümünü kurun, bilgisayarı yeniden başlatıp tekrar deneyin |
| `Node.js 22.12 veya üstü gerekli` | Eski Node.js sürümünü kaldırıp güncel LTS sürümünü kurun |

## Klasör yapısı

```
├─ PLAN.md                    Kapsam, hesaplama mantığı, veri modeli, yol haritası
├─ CLAUDE.md                  Geliştirme kuralları
├─ prisma/
│  ├─ schema.prisma           Veri modeli (tablolar)
│  ├─ migrations/             Veritabanı değişiklik geçmişi
│  └─ seed.ts                 Başlangıç verisi: İKY şablonu ve ilk yönetici
├─ scripts/with-db.mjs        Gömülü veritabanını başlatıp komutu çalıştıran yardımcı
├─ uploads/                   Fiş / fatura dosyaları (Git'e girmez; yedekleyin)
└─ src/
   ├─ app/
   │  ├─ login/               Giriş ekranı
   │  └─ (app)/               Oturum gerektiren ekranlar
   │     ├─ portfolio/        Portföy paneli
   │     ├─ projects/         Proje listesi, yeni proje sihirbazı
   │     │  └─ [projectId]/   Proje paneli, harcamalar, taşeron, bütçe, metraj, maliyet ağacı,
   │     │                    bloklar, bağımsız bölümler, arsa, raporlar
   │     ├─ company/          Bağlantılar, transfer, tedarikçiler, vade listesi, ortak fatura,
   │     │                    muhasebeci paketi, kütüphane
   │     └─ settings/         Kullanıcılar, döviz kurları, vergi/oran parametreleri, hesabım
   │  └─ api/                 Belge görüntüleme, Excel ve ZIP indirme
   ├─ components/             Arayüz bileşenleri (ui/ = shadcn/ui)
   ├─ lib/                    Saf (test edilebilir) mantık: yetki, sekmeler, İKY ağacı,
   │                          harcama tutarları (KDV, kur, bölme), Excel eşleme, TCMB,
   │                          sayı/tarih biçimleme, doğrulama
   ├─ server/                 Sunucu tarafı: veritabanı, oturum, yetki kontrolü, kayıt işlemleri
   └─ generated/prisma/       Prisma istemcisi (otomatik üretilir, Git'e girmez)
```

## Teknik notlar

- Next.js 16 (App Router) + TypeScript + Tailwind CSS 4 + shadcn/ui, Prisma 7 + PostgreSQL.
- Para ve alan değerleri veritabanında `Decimal`, kodda `decimal.js` ile tutulur; kayan nokta kullanılmaz.
- Yetki: yönetici tüm projeleri görür; diğer roller yalnızca yetkilendirildikleri projeleri.
  Tüm proje sorguları `src/lib/auth/access.ts` kapsamıyla süzülür ve her işlem sunucuda yeniden denetlenir.
- Değişiklikler `AuditLog` tablosuna (kim, neyi, ne zaman) yazılır.
- Harcama silme geri alınabilir şekilde yapılır (`deletedAt`); bölünmüş fatura payları birlikte
  ödenir ve birlikte silinir.
- Yüklenen dosyanın türü uzantıdan değil içeriğinden anlaşılır (JPEG, PNG, WebP, HEIC, PDF);
  dosya başına en fazla 15 MB.
