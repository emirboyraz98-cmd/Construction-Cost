# İnşaat Maliyet

İnşaat şirketi için maliyet, fiyatlandırma, harcama, bağlantı ve satış takip programı.
Kapsam ve yol haritası: [PLAN.md](PLAN.md).

**Durum: Faz 1 – Harcama girişi.**

- **Faz 0 (altyapı):** kullanıcı girişi ve roller, proje bazlı yetki, proje sekmeleri, yeni proje
  sihirbazı, portföy ve proje paneli, bloklar ve maliyet ağacı (İKY).
- **Faz 1 (harcama):** telefondan fotoğraflı hızlı giriş, ofiste tablo / Excel ile toplu giriş,
  onay akışı, tedarikçiler, döviz kurları (TCMB), vade listesi, harcama raporları,
  ortak faturanın projelere bölünmesi, avans kaydı ve muhasebeci paketi.

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
   │     │  └─ [projectId]/   Proje paneli, maliyet ağacı, bloklar, harcamalar, raporlar
   │     ├─ company/          Tedarikçiler, vade listesi, ortak fatura, muhasebeci paketi
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
