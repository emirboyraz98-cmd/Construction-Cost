# İnşaat Maliyet

İnşaat şirketi için maliyet, fiyatlandırma, harcama, bağlantı ve satış takip programı.
Kapsam ve yol haritası: [PLAN.md](PLAN.md).

**Durum: Faz 3 – Bina ve bütçe.**

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

Menüde henüz yapılmayan ekranlar **“Yakında”** olarak görünür.

---

## Windows'ta kurulum ve çalıştırma

Gerekenler: **Node.js 22.12 veya üstü** (Node 26 LTS uygundur) ve **Git**.
PostgreSQL kurmanıza gerek yoktur; program kendi veritabanını proje klasörünün içinde çalıştırır.

1. Komut istemini (PowerShell veya Terminal) **normal kullanıcı olarak** açın.
2. Projeyi indirin ve klasöre girin. Klasör yolunda Türkçe karakter ve boşluk olmaması önerilir,
   ör. `C:\projeler`:

   ```bash
   git clone https://github.com/emirboyraz98-cmd/Construction-Cost.git
   ```

   ```bash
   cd Construction-Cost
   ```

3. Bağımlılıkları yükleyin (ilk seferde internetten yaklaşık birkaç yüz MB indirir):

   ```bash
   npm install
   ```

4. Programı başlatın:

   ```bash
   npm run dev
   ```

   İlk çalıştırmada `.pgdata/` klasöründe veritabanı oluşturulur, tablolar ve varsayılan
   maliyet ağacı şablonu yüklenir. “Ready” yazısını görünce tarayıcıda
   **http://localhost:3000** adresini açın.

5. Kapatmak için komut penceresinde **Ctrl + C** tuşlarına basın. Veritabanı da düzgünce kapanır.

### Varsayılan giriş

| E-posta | Şifre |
|---|---|
| `yonetici@insaat.local` | `Yonetici.2026` |

Bu bir **test hesabıdır**. Giriş yaptıktan sonra sağ üstteki kullanıcı menüsünden
**Hesabım / şifre değiştir** ile şifrenizi değiştirin. Diğer çalışanları
**Ayarlar → Kullanıcılar** ekranından ekleyip rol ve proje yetkisi verin.

İlk yönetici hesabı veritabanında hiç kullanıcı yokken bir kez oluşturulur. Farklı bir
e-posta/şifre ile başlamak isterseniz `.env.example` dosyasını `.env` adıyla kopyalayıp
`SEED_ADMIN_*` değerlerini **ilk çalıştırmadan önce** değiştirin.

### Telefondan deneme (aynı Wi-Fi ağında)

Geliştirme modu (`npm run dev`) güvenlik nedeniyle yalnızca bu bilgisayardan açılır.
Telefondan denemek için uygulamayı derleyip üretim modunda başlatın:

```bash
npm run build
```

```bash
npm start
```

Sonra telefonda `http://<bilgisayarın-IP-adresi>:3000` adresini açın (IP adresini
`ipconfig` komutu gösterir). Windows Güvenlik Duvarı izin isterse “Özel ağlar” için izin verin.

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

### Telefona uygulama gibi ekleme

Telefonda programı açtıktan sonra tarayıcı menüsünden **“Ana ekrana ekle”** (Android / Chrome)
veya **Paylaş → “Ana Ekrana Ekle”** (iPhone / Safari) seçin. Program ana ekranda simgeyle açılır.
Fiş fotoğrafı çekerken telefon kamerası doğrudan açılır; fotoğraflar yüklenmeden önce küçültülür.

---

## Komutlar

| Komut | Ne yapar |
|---|---|
| `npm run dev` | Geliştirme modunda başlatır (veritabanı, migration ve başlangıç verisi dahil) |
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
| 3000 portu dolu | `npm run dev -- -p 3001` ile başka portta başlatın |

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
