import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Role } from "@/generated/prisma/enums";
import { ROLE_LABELS } from "@/lib/auth/roles";
import { getAccess } from "@/server/access";

export const metadata: Metadata = { title: "Nasıl kullanılır?" };

type Guide = { title: string; steps: (string | { text: string; href: string })[] };

const GUIDES: { roles: Role[]; guide: Guide }[] = [
  {
    roles: ["santiye_sefi", "yonetici", "muhasebe", "satin_alma"],
    guide: {
      title: "Harcama girmek (telefondan)",
      steps: [
        "Proje panelinde “Harcama gir”e basın.",
        "Fişin / faturanın fotoğrafını çekin.",
        "Maliyet kalemini seçin (yazmaya başlayınca listelenir) ve tutarı yazın. KDV dahil mi hariç mi seçin.",
        "Kaydet. Aynı fişten başka kalem varsa “Kaydet ve yeni”.",
        "İnternet yoksa kayıt telefonda bekler; üstte “Çevrimdışı” yazar, bağlantı gelince kendiliğinden gönderilir.",
        "Bağlantıdan (ön alım) malzeme geldiyse “Malzeme geldi”yi kullanın: irsaliye no ve miktar yeter.",
      ],
    },
  },
  {
    roles: ["muhasebe", "yonetici"],
    guide: {
      title: "Ofiste: onay, fatura ve ödemeler",
      steps: [
        "Zil simgesi bekleyen işleri gösterir (onay bekleyen kayıtlar, vadesi gelen ödemeler).",
        "Harcamalar → durum “Onay bekliyor” → kontrol edip onaylayın veya nedenini yazıp reddedin.",
        "Çok sayıda fatura: Harcamalar → Toplu giriş → e-Fatura XML / ZIP veya Excel. Maliyet kalemini seçip “Kontrol et → Aktar”.",
        { text: "Vade listesinden bu hafta ödenecekleri görün ve ödendi işaretleyin.", href: "/company/payables" },
        { text: "Ay sonunda muhasebeci paketini (Excel + fiş fotoğrafları) indirin.", href: "/company/accountant" },
      ],
    },
  },
  {
    roles: ["yonetici", "teknik_ofis"],
    guide: {
      title: "Yeni proje kurmak",
      steps: [
        { text: "“Yeni proje” ile proje bilgilerini girin (başlangıç tarihi ve süre önemli).", href: "/projects/new" },
        "Proje panelindeki “Proje kurulumu” kutusu sıradaki adımı gösterir: bloklar → bağımsız bölümler (“Kat kat üret”) → arsa sahipleri → bütçe → fiyat listesi → nakit varsayımları.",
        "Bütçe: Metraj ekranında katsayılar hazır gelir (beton, demir, kalıp …); “Bütçede olmayanları ekle” ile satırlar oluşur, fiyatları kütüphaneden veya elle girin.",
        "Fiyatlandırma: kâr ve komisyon oranını yazın, fiyatları kontrol edin, “Fiyat listesini onayla”. Satış ekibi onaylı listeyi görür.",
      ],
    },
  },
  {
    roles: ["satis", "yonetici", "muhasebe"],
    guide: {
      title: "Satış ve tahsilat",
      steps: [
        "Satışlar → “Kat planı” ile boş / rezerve / satılmış bölümleri görün.",
        "Müşteri bakıyorsa “Rezerve” (bitiş tarihiyle); karar verince “Sat”.",
        "Satış formunda indirim ve ödeme planı: peşinat, taksit sayısı, anahtar teslim → “Planı oluştur” → Satışı kaydet.",
        "Para gelince sözleşme sayfasında veya Tahsilatlar ekranında “Tahsil et”. Çek alındıysa çek seçin; vadesinde “Tahsil edildi” işaretleyin.",
        "Geciken taksitler Tahsilatlar ekranında ve zilde görünür.",
      ],
    },
  },
  {
    roles: ["yonetici", "teknik_ofis", "muhasebe", "dis_muhasebeci"],
    guide: {
      title: "Takip: bütçe, nakit, kâr",
      steps: [
        "Bütçe kontrolü: hangi kalem aşıldı / aşılacak; tahmini toplam maliyet (EAC).",
        "Nakit akışı: hangi ay ne kadar para gerekecek, en yüksek nakit ihtiyacı ve ayı.",
        "Senaryolar: “demir %15 artarsa”, “3 ay gecikirse” gibi durumlarda kâr ve nakit nasıl değişir.",
        { text: "Portföy: tüm projeler tek ekranda.", href: "/portfolio" },
      ],
    },
  },
  {
    roles: ["yonetici"],
    guide: {
      title: "Yönetici: kullanıcılar ve güvenlik",
      steps: [
        { text: "Kullanıcı ekleyin ve projelere rolüyle yetki verin (şantiye şefi yalnızca kendi şantiyesini görür).", href: "/settings/users" },
        { text: "Yedekler: program her gün otomatik yedek alır; arada bir harici diske kopyalayın.", href: "/settings/backups" },
        { text: "Değişiklik geçmişi: kim neyi ne zaman değiştirdi.", href: "/settings/history" },
        "Satış KDV oranlarını muhasebecinizle teyit edip Ayarlar → Parametreler'den düzeltin.",
      ],
    },
  },
];

export default async function HelpPage() {
  const { user } = await getAccess();
  const mine = GUIDES.filter((g) => g.roles.includes(user.role));
  return (
    <>
      <PageHeader title="Nasıl kullanılır?" description={`${ROLE_LABELS[user.role]} olarak en çok kullanacağınız işler, adım adım.`} />
      <div className="grid max-w-3xl grid-cols-1 gap-4">
        {mine.map(({ guide }) => (
          <Card key={guide.title} className="gap-3">
            <CardHeader>
              <CardTitle>{guide.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="grid list-decimal gap-1.5 pl-5 text-sm">
                {guide.steps.map((s, i) => (
                  <li key={i}>
                    {typeof s === "string" ? (
                      s
                    ) : (
                      <Link href={s.href} className="underline decoration-dotted underline-offset-2 hover:text-primary">
                        {s.text}
                      </Link>
                    )}
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        ))}
        <p className="text-sm text-muted-foreground">Takıldığınız bir yer olursa ekranlardaki açıklama yazılarına bakın; ayrıntılı kılavuz program klasöründeki README dosyasındadır.</p>
      </div>
    </>
  );
}
