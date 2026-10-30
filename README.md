# İnşaat Maliyet

İnşaat şirketi için maliyet, fiyatlandırma, harcama, bağlantı ve satış takip programı.
Kapsam ve yol haritası: [PLAN.md](PLAN.md).

**Durum: Faz 0 – Altyapı.** Kullanıcı girişi ve roller, proje bazlı yetki, proje sekmeleri,
yeni proje sihirbazı, portföy ve proje paneli, bloklar ve maliyet ağacı (İKY) hazır.
Harcama girişi Faz 1'de gelecek; menüde henüz yapılmayan ekranlar **“Yakında”** olarak görünür.

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
- **Yedek:** Program kapalıyken `.pgdata` klasörünü kopyalamanız yeterlidir.
  `.pgdata` klasörünü silmek **bütün verileri siler**.

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
└─ src/
   ├─ app/
   │  ├─ login/               Giriş ekranı
   │  └─ (app)/               Oturum gerektiren ekranlar
   │     ├─ portfolio/        Portföy paneli
   │     ├─ projects/         Proje listesi, yeni proje sihirbazı
   │     │  └─ [projectId]/   Proje paneli, maliyet ağacı, bloklar, “Yakında” modüller
   │     ├─ company/          Şirket geneli “Yakında” ekranlar (bağlantılar, tedarikçiler …)
   │     └─ settings/         Ayarlar, kullanıcılar, hesabım
   ├─ components/             Arayüz bileşenleri (ui/ = shadcn/ui)
   ├─ lib/                    Saf (test edilebilir) mantık: yetki, sekmeler, İKY ağacı,
   │                          hesaplar, sayı/tarih biçimleme, doğrulama
   ├─ server/                 Sunucu tarafı: veritabanı, oturum, yetki kontrolü, kayıt işlemleri
   └─ generated/prisma/       Prisma istemcisi (otomatik üretilir, Git'e girmez)
```

## Teknik notlar

- Next.js 16 (App Router) + TypeScript + Tailwind CSS 4 + shadcn/ui, Prisma 7 + PostgreSQL.
- Para ve alan değerleri veritabanında `Decimal`, kodda `decimal.js` ile tutulur; kayan nokta kullanılmaz.
- Yetki: yönetici tüm projeleri görür; diğer roller yalnızca yetkilendirildikleri projeleri.
  Tüm proje sorguları `src/lib/auth/access.ts` kapsamıyla süzülür ve her işlem sunucuda yeniden denetlenir.
- Değişiklikler `AuditLog` tablosuna (kim, neyi, ne zaman) yazılır.
