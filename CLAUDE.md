# CLAUDE.md

İnşaat şirketi için maliyet, fiyatlandırma, harcama, bağlantı ve satış takip programı.
Kapsam, hesaplama mantığı, veri modeli, ekranlar ve yol haritası **PLAN.md**'dedir; her işe
başlamadan ilgili bölümü oku. Plandaki kararlar (Bölüm 16) verilmiştir, yeniden tartışma.

## Kurallar
- Arayüz metinleri, mesajlar ve raporlar **Türkçe**. Kod tanımlayıcıları (değişken, tablo, fonksiyon) İngilizce.
- Para tutarları asla float ile hesaplanmaz; veritabanında `Decimal`, kodda decimal kütüphanesi.
- Vergi, harç ve yapı denetim oranları koda gömülmez; parametre tablosundan okunur.
- Her kayıt bir projeye bağlıdır (şirket geneli tablolar hariç: kaynak kütüphanesi, tedarikçiler,
  kurlar, bağlantılar). Sorgular kullanıcının proje yetkisine göre filtrelenir.
- Mobil uyumluluk zorunlu: şantiye şefi harcama girişini telefondan yapar.
- Hesap motoru saf TypeScript modülüdür ve birim testleriyle korunur.

## Kullanıcı
Şirket sahibi teknik olmayan bir kullanıcı; açıklamaları Türkçe ve sade yap.
