# İnşaat Maliyet

İnşaat şirketi için maliyet, fiyatlandırma, harcama, bağlantı ve satış takip programı.
Kapsam ve yol haritası: [PLAN.md](PLAN.md).

**Durum: Faz 5 – Fiyatlandırma.**

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

- Kapatmak için siyah pencerede **Ctrl + C**, sonra pencereyi kapatın. Veritabanı düzgünce kapanır.
- `baslat.bat` ve `demo.bat` aynı anda açılmaz (ikisi de 3000 portunu kullanır).
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
- **Yedek:** Program kapalıyken bu iki klasörü birlikte harici diske veya buluta kopyalayın.
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
- **Yedek:** Program kapalıyken **`.pgdata` ve `uploads` klasörlerinin ikisini birlikte** kopyalayın.
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
