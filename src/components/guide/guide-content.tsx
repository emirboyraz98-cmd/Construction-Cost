import type { ReactNode } from "react";
import { GuideSection, GuideStep, Nav, Shot, ShotRow, Tip } from "./guide-parts";

// Resimli kullanım kılavuzu: “Örnek – Ataşehir Konutları” projesinin baştan sona kurulumu.
// Ekran görüntüleri demo veritabanında bu adımlar gerçekten yapılarak çekildi (public/kilavuz).

export const GUIDE_TOC: {
  id: string;
  title: string;
  items?: { id: string; title: string }[];
}[] = [
  { id: "baslarken", title: "1. Başlarken" },
  { id: "hazirlik", title: "2. Bir kez yapılacak hazırlık" },
  {
    id: "kurulum",
    title: "3. Yeni proje: baştan sona kurulum",
    items: [
      { id: "k-bilgiler", title: "Proje bilgileri, arsa modeli, bloklar" },
      { id: "k-bolumler", title: "Bağımsız bölümler" },
      { id: "k-arsa", title: "Arsa sahipleri ve payları" },
      { id: "k-ekip", title: "Ekip" },
      { id: "k-butce", title: "Metraj ve bütçe" },
      { id: "k-fiyat", title: "Fiyat listesi" },
      { id: "k-nakit", title: "İş programı ve nakit" },
    ],
  },
  { id: "gunluk", title: "4. İnşaat sürerken: günlük işler" },
  { id: "satinalma", title: "5. Satın alma: bağlantı, taşeron, hakediş" },
  { id: "satis", title: "6. Satış ve tahsilat" },
  { id: "takip", title: "7. Takip: bütçe, nakit, senaryo" },
  { id: "aysonu", title: "8. Ay sonu ve güvenlik" },
  { id: "sss", title: "9. Sık sorulanlar" },
];

function Roles() {
  const rows: [string, string, string][] = [
    ["Yönetici", "Şirket sahibi / genel müdür", "Her şeyi görür; kullanıcı ekler, fiyat listesini onaylar."],
    ["Teknik ofis", "Metraj ve bütçe hazırlayan", "Bloklar, bölümler, metraj, birim fiyat, bütçe."],
    ["Şantiye şefi", "Şantiyedeki sorumlu", "Telefondan harcama ve “Malzeme geldi” girişi. Fiyat ve kâr bilgisini görmez."],
    ["Muhasebe", "Ofisteki muhasebe", "Harcama onayı, ödemeler, tahsilatlar, muhasebeci paketi."],
    ["Satın alma", "Malzeme alımı yapan", "Malzeme bağlantıları, tedarikçiler, teslimatlar."],
    ["Satış", "Satış ofisi / emlak", "Onaylı fiyat listesi, müşteri, satış, tahsilat. Maliyeti görmez."],
    ["Dış muhasebeci", "Şirket dışındaki mali müşavir", "Yalnızca okur; dönem sonu Excel paketini indirir."],
  ];
  return (
    <div className="max-w-3xl overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-left">
          <tr>
            <th className="p-2 font-medium">Rol</th>
            <th className="p-2 font-medium">Kim?</th>
            <th className="p-2 font-medium">Ne yapar?</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([r, who, what]) => (
            <tr key={r} className="border-t align-top">
              <td className="p-2 font-medium whitespace-nowrap">{r}</td>
              <td className="p-2 text-muted-foreground">{who}</td>
              <td className="p-2">{what}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Faq({ q, children }: { q: string; children: ReactNode }) {
  return (
    <details className="group max-w-3xl rounded-lg border p-3 text-sm open:bg-muted/30 print:open:bg-transparent" open={false}>
      <summary className="cursor-pointer font-medium marker:text-muted-foreground">{q}</summary>
      <div className="mt-2 grid gap-1.5 leading-relaxed">{children}</div>
    </details>
  );
}

export function GuideContent({ print = false }: { print?: boolean }) {
  return (
    <div className="grid gap-10">
      {/* 1 */}
      <GuideSection
        id="baslarken"
        title="1. Başlarken"
        intro="Bu kılavuz, örnek bir projeyi (“Örnek – Ataşehir Konutları”, 1 blok, 16 bağımsız bölüm, kat karşılığı) sıfırdan kurarak programın tamamını gösterir. Rakamlar örnektir; kendi projenizde kendi rakamlarınızı girin."
      >
        <GuideStep n="1" title="Programı açmak ve giriş yapmak">
          <ol>
            <li>
              Bilgisayarda program klasöründeki <Nav>baslat.bat</Nav> dosyasına çift tıklayın. Siyah pencerede “Program hazır” yazınca tarayıcı kendiliğinden açılır. Siyah pencereyi kapatmayın;
              kapatırsanız program durur.
            </li>
            <li>
              E-posta ve şifrenizle giriş yapın. İlk girişten sonra şifrenizi <Nav>Ayarlar → Şifre değiştir</Nav> ekranından değiştirin.
            </li>
            <li>
              Telefondan girmek için: siyah pencerede “Aynı Wi-Fi’daki telefondan: http://192.168…” diye yazan adresi telefonun tarayıcısında açın. Telefon ve bilgisayar aynı Wi-Fi ağında olmalı.
            </li>
          </ol>
          <Shot eager={print} src="01-giris" alt="Giriş ekranı" caption="Giriş ekranı. 15 dakikada 5 kez yanlış şifre girilirse hesap 15 dakika kilitlenir." />
          <Tip>
            Denemek için <Nav>demo.bat</Nav> ile örnek verili programı açın. Demo ayrı bir veritabanı kullanır; orada ne yaparsanız yapın gerçek verileriniz etkilenmez.
          </Tip>
        </GuideStep>

        <GuideStep n="2" title="Ekranın düzeni">
          <ul>
            <li>
              <b>Üstte proje sekmeleri:</b> açtığınız projeler sekme olarak durur; tarayıcıdaki sekmeler gibi aralarında geçiş yapılır.
            </li>
            <li>
              <b>Solda menü:</b> üst kısım seçili projenin ekranlarıdır (Günlük işler, Satın alma, Bina ve maliyet, Satış, Finans ve rapor). Alt kısım “Şirket geneli”dir (Portföy, Bağlantılar,
              Tedarikçiler, Vade listesi, Ayarlar …). Herkes yalnızca yetkisi olan menüleri görür.
            </li>
            <li>
              <b>Zil:</b> sizi bekleyen işler (onay bekleyen kayıtlar, vadesi gelen ödemeler, geciken taksitler).
            </li>
            <li>
              <b>Sağ üstte adınız:</b> kullanıcı menüsü, <Nav>Nasıl kullanılır?</Nav> ve çıkış.
            </li>
          </ul>
        </GuideStep>

        <GuideStep n="3" title="Kim ne yapar? (roller)">
          <p>Her kullanıcının bir rolü vardır; rol, neleri görüp neleri yapabileceğini belirler. Bir kullanıcıya her projede farklı rol verilebilir.</p>
          <Roles />
        </GuideStep>
      </GuideSection>

      {/* 2 */}
      <GuideSection
        id="hazirlik"
        title="2. Bir kez yapılacak hazırlık"
        intro="Bunlar şirket genelidir; her projede tekrar yapılmaz. Hepsini ilk gün yapmanız gerekmez, ama KDV oranlarını kontrol etmeden fiyat listesi onaylamayın."
      >
        <GuideStep n="1" title="Kullanıcıları ekleyin">
          <p>
            <Nav>Ayarlar → Kullanıcılar → Kullanıcı ekle</Nav>: ad, e-posta, geçici şifre ve rol. Proje yetkisini proje açıldıktan sonra vereceğiz (bkz. 3.6).
          </p>
        </GuideStep>
        <GuideStep n="2" title="Vergi ve oran parametrelerini muhasebecinizle kontrol edin">
          <p>
            <Nav>Ayarlar → Vergi, harç ve oran parametreleri</Nav>. Program hiçbir oranı kendi içinde sabit tutmaz; KDV oranları, satışta konut KDV’si ve net alan sınırı buradan gelir.
          </p>
          <Shot eager={print} src="43-parametreler" alt="Parametreler ekranı" />
          <Tip tone="warn">Satış KDV oranları (net 150 m²’ye kadar konut %10, diğerleri %20) programın başlangıç değeridir. Muhasebecinize teyit ettirmeden fiyat listesi onaylamayın.</Tip>
        </GuideStep>
        <GuideStep n="3" title="Diğer hazırlıklar (isteğe bağlı, sonra da yapılabilir)">
          <ul>
            <li>
              <Nav>Ayarlar → Döviz kurları</Nav>: TCMB’den getir veya elle gir. Dövizli fatura ve bağlantılar için gerekir.
            </li>
            <li>
              <Nav>Ayarlar → Maliyet ağacı şablonu</Nav>: yeni projelerin maliyet kalemleri (İKY). Kullanmadığınız kalemleri pasif yapın, eksik olanı ekleyin. Hazır şablonda 135 kalem vardır.
            </li>
            <li>
              <Nav>Tedarikçiler</Nav>: çalıştığınız firmalar (vergi no ile). Harcama girerken de “yeni tedarikçi” açılabilir.
            </li>
            <li>
              <Nav>Kütüphane</Nav>: malzeme, işçilik ve makine fiyatları. Faturalardan gelen fiyatlar buraya kendiliğinden yazılır; bütçe bu fiyatları kullanır.
            </li>
          </ul>
        </GuideStep>
      </GuideSection>

      {/* 3 */}
      <GuideSection
        id="kurulum"
        title="3. Yeni proje: baştan sona kurulum"
        intro="Bir projeyi kurmak 8 adımdır. Proje açıldığında panelde “Proje kurulumu” kutusu çıkar ve sıradaki adımı gösterir; hepsi bitince kutu kendiliğinden kalkar. Aşağıda adımları sırayla örnek projede yapıyoruz."
      >
        <Shot
          eager={print}
          src="05-proje-kurulum-listesi"
          alt="Proje kurulum adımları kutusu"
          caption="Yeni projede panelin üstündeki “Proje kurulumu” kutusu. Biten adımların üstü çizilir; adıma tıklayınca ilgili ekran açılır."
        />

        <GuideStep id="k-bilgiler" n="3.1" title="Proje bilgileri (sihirbaz 1. adım)">
          <ol>
            <li>
              Üstteki sekmelerden <Nav>+ Yeni proje</Nav>.
            </li>
            <li>
              “Başlangıç”ta <b>Boş proje — varsayılan şablondan</b> seçili kalsın. (Daha önceki bir projenin maliyet ağacını ve bloklarını kopyalamak isterseniz onu seçin.)
            </li>
            <li>Proje adı ve tipi zorunludur. Adres, ada / parsel, arsa alanı, emsal (KAKS) ve TAKS’ı da yazın; program emsal alanını ve taban oturumunu hesaplar.</li>
            <li>
              <b>Başlangıç tarihi ve süre (ay)</b> çok önemlidir: nakit akışı ve iş programı bunlara göre çıkar. Örnekte 1 Kasım 2026, 24 ay.
            </li>
          </ol>
          <Shot eager={print} src="02-sihirbaz-bilgiler" alt="Yeni proje sihirbazı, proje bilgileri" />
        </GuideStep>

        <GuideStep n="3.2" title="Arsa modeli (sihirbaz 2. adım)">
          <ul>
            <li>
              <b>Kat karşılığı:</b> arsa sahiplerine daire / dükkân verilir. Arsa sahibi payı ve kira yardımları izlenir.
            </li>
            <li>
              <b>Arsa satın alma:</b> arsa parayla alınır. Arsa bedeli ödeme planıyla izlenir.
            </li>
            <li>
              <b>Karma:</b> kat karşılığına ek olarak arsa sahibine nakit / şerefiye ödenir.
            </li>
          </ul>
          <Shot eager={print} src="03-sihirbaz-arsa" alt="Arsa modeli seçimi" />
        </GuideStep>

        <GuideStep n="3.3" title="Bloklar (sihirbaz 3. adım) ve projeyi oluşturmak">
          <p>
            Her blok için ad, kat adedi, bodrum sayısı ve inşaat alanı (m²). Örnekte tek blok: <b>A Blok, 7 kat, 1 bodrum, 3.200 m²</b>. Birden fazla blok varsa <Nav>Blok ekle</Nav>. Sonra{" "}
            <Nav>Projeyi oluştur</Nav>: proje kendi sekmesinde açılır ve maliyet ağacı şablondan kopyalanır.
          </p>
          <Shot eager={print} src="04-sihirbaz-bloklar" alt="Bloklar adımı" />
          <Shot eager={print} src="06-bloklar" alt="Bloklar ekranı" caption="Blokları sonradan düzeltmek için: soldaki menüden Bloklar." />
        </GuideStep>

        <GuideStep id="k-bolumler" n="3.4" title="Bağımsız bölümler: “Kat kat üret”">
          <p>
            Aynı tipteki daireleri tek tek girmek yerine katlara toplu dağıtın: <Nav>Bağımsız bölümler → Kat kat üret</Nav>.
          </p>
          <ol>
            <li>
              Önce zemin kat dükkânları: ilk kat <b>0</b>, son kat <b>0</b>, kattaki bölüm <b>2</b>, ilk kapı no <b>1</b>, net 90 m², brüt 110 m², kullanım <b>Dükkân</b>. <Nav>Üret</Nav>.
            </li>
            <li>
              Sonra daireler: ilk kat <b>1</b>, son kat <b>7</b>, kattaki bölüm <b>2</b>, ilk kapı no <b>3</b>, net 140 m², brüt 175 m², kullanım Konut, tip <b>3+1</b>. <Nav>Üret</Nav>.
            </li>
          </ol>
          <Shot eager={print} src="07-kat-kat-uret" alt="Kat kat üret penceresi" caption="7 kat × 2 = 14 daire bir seferde açılır. Farklı olanı sonra kalem simgesiyle tek tek düzeltin." />
          <p>Sonuç: 16 bölüm, satılabilir brüt 2.670 m², net 2.140 m². Program bölümlerin toplam alanını blok inşaat alanıyla karşılaştırır (üstteki satır: 2.670 / 3.200 m², %83,4).</p>
        </GuideStep>

        <GuideStep id="k-arsa" n="3.5" title="Arsa sahipleri ve payları">
          <ol>
            <li>
              <Nav>Arsa & sözleşme → Arsa sahibi ekle</Nav>: ad soyad, sözleşmedeki pay oranı (örnekte <b>%41</b>), aylık kira yardımı (örnekte 25.000 TL), telefon.
            </li>
            <li>
              Arsa sahibine verilecek bölümleri işaretleyin: <Nav>Bağımsız bölümler</Nav> ekranında bölümlerin solundaki kutuları seçin → üstte çıkan <Nav>Sahibini değiştir…</Nav> listesinden arsa
              sahibini seçin → <Nav>Uygula</Nav>.
            </li>
            <li>Program sözleşmedeki pay ile işaretlenen bölümlerin brüt m² oranını karşılaştırır. Fark 0,5 puandan fazlaysa kırmızı uyarı verir.</li>
          </ol>
          <Shot eager={print} src="09-arsa-sahibi" alt="Arsa ve sözleşme ekranı" />
          <Shot eager={print} src="10-sahiplik-isaretle" alt="Bölümleri seçip sahibini değiştirme" caption="Bölümleri seçince üstte toplu işlem çubuğu çıkar." />
          <Shot
            eager={print}
            src="08-bagimsiz-bolumler"
            alt="Bağımsız bölümler listesi ve pay kontrolü"
            caption="Örnekte 2 dükkân + 5 daire arsa sahibine: 1.095 m² / 2.670 m² = %41,01. Sözleşme %41 ile uyumlu (yeşil)."
          />
          <Tip tone="calc">
            Müteahhide kalan brüt alan = 2.670 − 1.095 = <b>1.575 m²</b>. Satılabilir m² maliyeti bu alana bölünür; çünkü arsa sahibinin dairelerinin inşaat maliyetini de müteahhit öder.
          </Tip>
        </GuideStep>

        <GuideStep id="k-ekip" n="3.6" title="Ekip: kullanıcılara proje yetkisi">
          <p>
            <Nav>Ayarlar → Kullanıcılar</Nav> → kişinin satırında <Nav>Düzenle</Nav> → “Proje yetkileri” bölümünde projeyi işaretleyin, o projedeki rolünü seçin → <Nav>Kaydet</Nav>. Örnekte şantiye
            şefi, muhasebe ve satış kullanıcılarına yetki verildi.
          </p>
          <Shot eager={print} src="11-kullanici-yetki" alt="Kullanıcıya proje yetkisi verme" caption="Kullanıcı yalnızca işaretli projeleri görür. Yönetici zaten tüm projeleri görür." />
        </GuideStep>

        <GuideStep id="k-butce" n="3.7" title="Metraj ve bütçe">
          <p>Bütçe üç yoldan doldurulur; aynı projede üçünü birlikte kullanabilirsiniz:</p>
          <p className="font-medium">a) Parametrik metraj (katsayıyla, en hızlısı)</p>
          <p>
            <Nav>Metraj</Nav> ekranında beton, demir, kalıp, iç sıva ve iç boya için hazır katsayılar vardır (ör. beton 0,42 m³ / m² inşaat alanı). Program bunları alanla çarpar: 3.200 m² × 0,42 =
            1.344 m³ beton. <Nav>Bütçede olmayanları ekle</Nav> ile bu satırlar bütçeye eklenir. Katsayıları projenize göre düzeltin.
          </p>
          <Shot eager={print} src="12-metraj" alt="Metraj ekranı ve katsayılar" />
          <p className="font-medium">b) Birim fiyat vermek</p>
          <p>
            <Nav>Bütçe</Nav> ekranında satırın kalem simgesi (<Nav>Düzenle</Nav>) → “Birim fiyat” bölümünde üç seçenek:
          </p>
          <ul>
            <li>
              <b>Elle / taşeron fiyatı:</b> fiyatı kendiniz yazarsınız (ör. kalıp 450 TL/m²).
            </li>
            <li>
              <b>Kütüphane:</b> malzemeyi seçersiniz; fiyat kendiliğinden gelir ve güncel kalır. Öncelik sırası: geçerli bağlantı fiyatı → son alım (fatura) → teklif → piyasa.
            </li>
            <li>
              <b>Reçete:</b> 1 birim iş için malzeme + işçilik tarifi (ör. 1 m² seramik = seramik + yapıştırıcı + derz + ustalık).
            </li>
          </ul>
          <p>Fire (%) da buradan girilir; örnekte beton %2, demir %3.</p>
          <Shot eager={print} src="13-butce-satiri" alt="Bütçe satırı düzenleme penceresi" />
          <p className="font-medium">c) Excel’den toplu aktarım (keşif / metraj cetveli)</p>
          <ol>
            <li>
              <Nav>Bütçe → Excel’den aktar</Nav>.
            </li>
            <li>Excel dosyasını seçin veya Excel’de satırları kopyalayıp sayfaya yapıştırın (Ctrl+V). Gereken sütunlar: kalem kodu (ör. 05.07) veya kalem adı, metraj, birim, birim fiyat.</li>
            <li>Program sütunları tahmin eder; yanlışsa üstteki listelerden düzeltin.</li>
            <li>
              <Nav>Kontrol et</Nav>: kodu bulunamayan satırlar kırmızı işaretlenir ve eklenmez. Sonra <Nav>… satırı bütçeye ekle</Nav>.
            </li>
          </ol>
          <Shot
            eager={print}
            src="14-excel-aktar"
            alt="Excel’den bütçe aktarımı, kontrol sonucu"
            caption="Örnekte 32 satırlık keşif listesi bir seferde eklendi. Yanlış kodlu satır (99.99) atlandı."
          />
          <p className="font-medium">Bütçe ekranını okumak</p>
          <Shot eager={print} src="15-butce" alt="Bütçe ekranı" />
          <ul>
            <li>
              <b>Toplam maliyet:</b> tüm bina, KDV hariç. Örnekte ₺70.170.766.
            </li>
            <li>
              <b>İnşaat m² maliyeti:</b> yapım maliyeti (04–12 grupları) ÷ toplam inşaat alanı.
            </li>
            <li>
              <b>Müteahhit satılabilir m² maliyeti:</b> toplam maliyet ÷ müteahhide kalan brüt m². Fiyatlandırma bu rakamla başlar.
            </li>
          </ul>
          <Tip tone="calc">70.170.766,40 TL ÷ 1.575 m² = 44.552,87 TL / m² (müteahhit satılabilir m² maliyeti).</Tip>
          <p className="font-medium">Baz bütçeyi dondurmak</p>
          <p>
            Bütçe hazır olunca <Nav>Bütçe kontrolü → Bütçeyi dondur (baz bütçe)</Nav>. Bu, bugünkü bütçenin fotoğrafıdır; inşaat boyunca sapmalar bu referansa göre izlenir. Güncel bütçe ise fiyat ve
            metraj değiştikçe değişmeye devam eder.
          </p>
        </GuideStep>

        <GuideStep id="k-fiyat" n="3.8" title="Fiyat listesi">
          <p>
            <Nav>Fiyatlandırma</Nav> ekranı maliyetten satış fiyatına giden yolu gösterir: maliyet + reklam payı → kâr ve komisyonla baz m² fiyatı → kat / cephe / manzara katsayıları → bölüm
            fiyatları.
          </p>
          <Shot eager={print} src="17-fiyatlandirma" alt="Fiyatlandırma ekranı özeti" caption="Üstteki kutular: maliyet, başabaş fiyatı, baz m² satış fiyatı, hedef gelir, beklenen kâr." />
          <ol>
            <li>
              <b>Ayarlar:</b> kâr yöntemi (satış üzerinden marj veya maliyet üzerine ekleme), hedef marj (örnekte %25), emlakçı komisyonu (%2), yuvarlama adımı (10.000 TL). Konutlar indirimli KDV
              şartlarını sağlıyorsa kutuyu işaretli bırakın. <Nav>Kaydet ve yeniden hesapla</Nav>.
            </li>
            <li>
              <b>Katsayılar:</b> üst katlar daha değerliyse kat katsayısı verin (örnekte 1. kat 0,96 … 7. kat 1,10). Boş = 1,00. Katsayılar toplam geliri değiştirmez, yalnızca dağılımı değiştirir.
            </li>
            <li>
              <b>Bölüm fiyatları:</b> tabloda her bölümün KDV hariç ve KDV dahil fiyatı görünür. Bir fiyatı sabitlemek isterseniz seçip <Nav>Seçilenleri kilitle</Nav>.
            </li>
            <li>
              <b>Onay:</b> <Nav>Fiyat listesini onayla</Nav> → ad verin → <Nav>Onayla</Nav>. Satış ekibi yalnızca onaylı listeyi görür. Her onay ayrı sürüm olarak saklanır; Excel ve PDF olarak
              indirilebilir.
            </li>
          </ol>
          <ShotRow>
            <Shot eager={print} src="18-fiyat-ayarlari" alt="Fiyatlandırma ayarları" />
            <Shot eager={print} src="19-katsayilar" alt="Kat katsayıları" />
          </ShotRow>
          <Shot eager={print} src="20-bolum-fiyatlari" alt="Bölüm fiyatları tablosu" caption="Arsa sahibinin bölümleri fiyatlanmaz; listede ayrıca belirtilir." />
          <Shot eager={print} src="21-fiyat-onay" alt="Fiyat listesini onaylama penceresi" />
          <Tip tone="calc">
            Baz m² fiyatı = m² maliyeti ÷ (1 − marj − komisyon) = 44.552,87 ÷ (1 − 0,25 − 0,02) = <b>61.031 TL / m²</b>. 1.575 m² × 61.031 ≈ 96,1 milyon TL hedef gelir; komisyon ve maliyet düşünce
            beklenen kâr ≈ 24 milyon TL (%25).
          </Tip>
          <Tip>
            Ekran görüntülerindeki rakamlar adımlar ilerledikçe biraz değişir. Örneğin beton bağlantısı (5. bölüm) girilince bütçe bağlantı fiyatını kullanmaya başlar. Program fiyatları canlı
            hesaplar; onaylı fiyat listesi ise onay anındaki haliyle saklanır.
          </Tip>
        </GuideStep>

        <GuideStep id="k-nakit" n="3.9" title="İş programı ve nakit varsayımları">
          <ol>
            <li>
              <Nav>Nakit akışı → İş programı → Varsayılan program öner</Nav>: maliyet grupları tipik konut sırasına göre aylara yayılır (hafriyat başta, ince işler sonda). Projeye göre düzeltin.
            </li>
            <li>
              <Nav>Nakit akışı</Nav> ekranında varsayımları girin: başlangıç nakdi (özkaynak), aylık maliyet artışı, aylık finansman maliyeti, ayda kaç bölüm satılacağı, satışın kaçıncı ayda
              başlayacağı, peşinat oranı ve taksit sayısı. <Nav>Kaydet ve yeniden hesapla</Nav>.
            </li>
          </ol>
          <Shot eager={print} src="22-is-programi" alt="İş programı" />
          <Shot
            eager={print}
            src="23-nakit-varsayimlar"
            alt="Nakit akışı varsayımları"
            caption="Örnek: 15 milyon TL başlangıç nakdi, aylık %2 maliyet artışı, %3 finansman, ayda 1 bölüm, 3. aydan itibaren, %40 peşinat + 12 taksit."
          />
          <Shot
            eager={print}
            src="24-nakit-akisi"
            alt="Nakit akışı grafiği"
            caption="Mavi: giriş, turuncu: çıkış, yeşil çizgi: kasadaki birikmiş para. Çizgi sıfırın altına inerse o ay dışarıdan para gerekir."
          />
          <Tip tone="warn" title="Bu örnekten çıkan ders">
            Aylık %2 maliyet artışı girilince beklenen kâr %25’ten yaklaşık %4’e düşüyor. Çünkü fiyat listesi bugünkü maliyetle hesaplandı, oysa harcamalar 24 aya yayılıyor. Böyle bir durumda fiyat
            listesini artışa göre güncelleyin veya <Nav>Senaryolar</Nav> ekranında farklı durumları karşılaştırın (bkz. 7. bölüm).
          </Tip>
          <p>8 adım bitince panelden “Proje kurulumu” kutusu kalkar. Proje artık günlük kullanıma hazırdır.</p>
        </GuideStep>
      </GuideSection>

      {/* 4 */}
      <GuideSection
        id="gunluk"
        title="4. İnşaat sürerken: günlük işler"
        intro="Şantiye şefi harcamayı telefondan girer, ofis onaylar. Onaylanan kayıt bütçe kontrolüne, raporlara ve muhasebeci paketine kendiliğinden yansır."
      >
        <GuideStep n="1" title="Şantiye şefi: telefondan harcama girmek">
          <ol>
            <li>
              Telefonda programı açın. Tek projesi olan şantiye şefi doğrudan harcama ekranına gelir; değilse proje panelinde <Nav>Harcama gir</Nav>.
            </li>
            <li>
              <Nav>Fotoğraf çek</Nav> ile fişin / faturanın fotoğrafını çekin.
            </li>
            <li>Maliyet kalemini seçin: kutuya “kazı”, “beton” gibi yazmaya başlayın, liste daralır.</li>
            <li>Tutarı yazın; KDV dahil mi hariç mi seçin. Program matrahı ve KDV’yi ayırır.</li>
            <li>Belge no, belge türü (fatura / fiş / irsaliye …), ödendi mi, vadesi. Tedarikçi isteğe bağlıdır.</li>
            <li>
              <Nav>Kaydet</Nav>. Aynı fişte başka kalem varsa <Nav>Kaydet ve yeni</Nav>.
            </li>
          </ol>
          <ShotRow>
            <Shot eager={print} src="25-m-panel" alt="Telefonda proje paneli" mobile caption="Telefonda proje paneli: büyük düğmeler." />
            <Shot eager={print} src="26-m-harcama" alt="Telefonda harcama girişi" mobile caption="120.000 TL KDV dahil → matrah 100.000 + KDV 20.000." />
            <Shot eager={print} src="27-m-harcama-2" alt="Telefonda harcama girişi, belge ve ödeme" mobile caption="Belge türü, ödeme durumu ve vade." />
          </ShotRow>
          <Tip>İnternet yoksa kayıt telefonda bekler. Üstte “Çevrimdışı” yazar; bağlantı gelince kayıt kendiliğinden gönderilir. Bu göstergeye basınca bekleyen kayıtlar listelenir.</Tip>
        </GuideStep>

        <GuideStep n="2" title="Ofis: onay ve red">
          <ol>
            <li>
              Zil veya proje panelindeki <Nav>Onay bekleyen (N)</Nav> düğmesi listeyi açar.
            </li>
            <li>
              Kaydı açıp fotoğrafı kontrol edin; <Nav>Onayla</Nav>. Birden çok kayıt için soldaki kutuları seçip üstteki <Nav>Onayla</Nav>.
            </li>
            <li>
              Hatalıysa <Nav>Reddet</Nav> ve nedenini yazın. Kaydı giren kişi düzeltip kaydedince kayıt yeniden onaya gelir.
            </li>
          </ol>
          <Shot eager={print} src="28-onay" alt="Harcama listesinde toplu onay" />
          <Tip>Muhasebe ve yöneticinin girdiği kayıtlar doğrudan onaylı başlar. Şantiye şefi kendi kaydını onaylanana kadar düzeltebilir; onaydan sonra düzeltmeyi muhasebe yapar.</Tip>
        </GuideStep>

        <GuideStep n="3" title="Ofis: çok sayıda faturayı bir seferde girmek">
          <p>
            <Nav>Harcamalar → Toplu giriş / Excel</Nav>: Excel tablosu yapıştırın veya GİB’den indirdiğiniz e-Fatura XML / ZIP dosyalarını seçin (<Nav>e-Fatura / e-Arşiv (XML)</Nav> kutusu). Program
            fatura satırlarını okur ve tedarikçinin daha önce kullanılan kalemini önerir. <Nav>Kontrol et</Nav> → <Nav>… satırı aktar</Nav>. Aynı fatura iki kez girilirse uyarır.
          </p>
        </GuideStep>

        <GuideStep n="4" title="Ödemeler: vade listesi">
          <p>
            <Nav>Vade listesi</Nav> (şirket geneli): ödenmemiş harcamalar, bağlantı taksitleri ve onaylı hakedişlerin net ödemeleri vade sırasıyla görünür. Ödeme yapınca kaydı seçip{" "}
            <Nav>Ödendi işaretle</Nav>.
          </p>
          <Shot eager={print} src="38-vade-listesi" alt="Vade listesi" />
        </GuideStep>
      </GuideSection>

      {/* 5 */}
      <GuideSection id="satinalma" title="5. Satın alma: bağlantı, taşeron, hakediş">
        <GuideStep n="1" title="Malzeme bağlantısı (ön alım)">
          <p>Tedarikçiyle önceden miktar ve fiyat sabitlediyseniz (ör. 1.400 m³ beton, 3.150 TL/m³):</p>
          <ol>
            <li>
              <Nav>Bağlantılar → Yeni bağlantı</Nav>: tedarikçi, fiyat tipi (sabit / dövize bağlı), geçerlilik ve son çekiş tarihi.
            </li>
            <li>Kalemler: malzeme adı, maliyet kalemi (ör. 05.04.01 Hazır beton), isteğe bağlı kütüphane malzemesi, miktar, birim, birim fiyat, KDV.</li>
            <li>
              Kaydettikten sonra bağlantı sayfasında <Nav>Tahsis</Nav>: miktarı projelere paylaştırın. Tahsis edilmeyen kısım “şirket geneli havuz”da kalır.
            </li>
            <li>
              <Nav>Ödeme ekle</Nav>: avans, taksit, çek vadeleri. Ödenmeyenler vade listesine düşer.
            </li>
          </ol>
          <Shot eager={print} src="29-baglanti" alt="Bağlantı sayfası" caption="Çekilen / kalan miktar, ödemeler, faturalar ve bağlantı kazancı tek sayfada." />
          <Tip tone="calc">
            1.400 m³ × 3.150 TL = 4.410.000 + %20 KDV = 5.292.000 TL. Güncel piyasa fiyatı 3.650 TL ise <b>bağlantı kazancı</b> = (3.650 − 3.150) × 1.400 = 700.000 TL.
          </Tip>
        </GuideStep>

        <GuideStep n="2" title="Şantiye: “Malzeme geldi”">
          <p>
            Bağlantıdan malzeme gelince şantiye şefi <Nav>Malzeme geldi</Nav>: hangi bağlantıdan, gelen miktar, irsaliye no, (varsa) irsaliye fotoğrafı. Tutar bağlantı fiyatından kendiliğinden
            hesaplanır; ödemesi bağlantının ödeme planında izlenir. Ofis onaylayınca maliyete yazılır.
          </p>
          <Shot eager={print} src="30-m-malzeme-geldi" alt="Telefonda malzeme geldi ekranı" mobile />
        </GuideStep>

        <GuideStep n="3" title="Taşeron sözleşmesi ve hakediş">
          <ol>
            <li>
              <Nav>Taşeron & hakediş → Yeni sözleşme</Nav>: taşeron, sözleşme no, iş, temin şekli, KDV, <b>KDV tevkifatı</b> (ör. 4/10 için 40), <b>teminat kesintisi</b> (%5), avans mahsup oranı ve
              birim fiyatlar (ör. betonarme işçiliği 3.200 m² × 1.400 TL).
            </li>
            <li>
              Her dönem: sözleşme sayfasında <Nav>Hakediş hazırla</Nav> → her iş kalemine <b>kümülatif</b> miktarı (bugüne kadar yapılan toplam) yazın; program bu dönemi kendisi hesaplar.
            </li>
            <li>
              <Nav>Taslağı kaydet</Nav> → <Nav>Onaya gönder</Nav> → yetkili <Nav>Onayla</Nav>. Onaylanan hakedişin net ödemesi vade listesine girer.
            </li>
            <li>
              <Nav>PDF / yazdır</Nav>: imza alanlı hakediş çıktısı.
            </li>
          </ol>
          <Shot eager={print} src="31-taseron" alt="Taşeron sözleşmesi sayfası" />
          <Shot eager={print} src="32-hakedis" alt="Hakediş hazırlama, kesintiler" />
          <Tip tone="calc">
            1. hakediş 400 m²: brüt 560.000 + KDV 112.000 − tevkifat 44.800 − teminat 28.000 = net <b>599.200 TL</b>.
          </Tip>
          <Tip tone="warn">Tevkifat ve teminat oranlarını muhasebecinizle teyit edin; program sabit oran kullanmaz.</Tip>
        </GuideStep>
      </GuideSection>

      {/* 6 */}
      <GuideSection
        id="satis"
        title="6. Satış ve tahsilat"
        intro="Satış ekibi onaylı fiyat listesini görür; maliyet ve kârı görmez. Satılan bölümün fiyatı kilitlenir, sonraki fiyat değişikliklerinden etkilenmez."
      >
        <GuideStep n="1" title="Satışlar ekranı">
          <p>
            Boş / rezerve / satıldı / arsa sahibi bölümler, toplam satış, tahsil edilen ve kalan alacak. <Nav>Kat planı</Nav> düğmesi bölümleri renkli kutular halinde gösterir.
          </p>
          <Shot eager={print} src="33-satislar" alt="Satışlar ekranı" />
        </GuideStep>
        <GuideStep n="2" title="Rezervasyon (isteğe bağlı)">
          <p>
            Müşteri düşünüyorsa bölümün satırında <Nav>Rezerve</Nav>: müşteri, başlangıç ve bitiş tarihi, kapora, teklif fiyatı. Süresi dolan rezervasyon kendiliğinden düşer; satış yapılınca
            rezervasyon satışa dönüşür.
          </p>
        </GuideStep>
        <GuideStep n="3" title="Satış ve ödeme planı">
          <ol>
            <li>
              Bölümün satırında <Nav>Sat</Nav> (veya panelde <Nav>Satış yap</Nav>).
            </li>
            <li>
              Müşteri: kutuya adını yazın; kayıtlı değilse <Nav>+ Yeni müşteri</Nav> ile T.C. kimlik / vergi no ve telefonunu girin.
            </li>
            <li>Liste fiyatı onaylı listeden gelir. İndirim yazınca satış fiyatı, KDV ve toplam hesaplanır.</li>
            <li>
              Ödeme planı: peşinat, taksit sayısı, ilk taksit tarihi, varsa anahtar teslim ödemesi ve banka kredisi → <Nav>Planı oluştur</Nav>. Kalan tutar eşit taksitlere bölünür; ara ödeme için
              satır ekleyebilirsiniz.
            </li>
            <li>
              <Nav>Satışı kaydet</Nav>.
            </li>
          </ol>
          <Shot eager={print} src="35-satis-plani" alt="Satış formu, ödeme planı" />
          <Tip tone="calc">
            A Blok No 8: liste 10.310.000 − indirim 110.000 = 10.200.000 + %10 KDV = 11.220.000 TL. Peşinat 4.488.000 (%40), kalan 6.732.000 ÷ 12 = <b>561.000 TL taksit</b>.
          </Tip>
        </GuideStep>
        <GuideStep n="4" title="Tahsilat">
          <ol>
            <li>
              Sözleşme sayfasında <Nav>Tahsilat gir</Nav>: tarih, tutar, ödeme şekli (nakit / havale / çek / senet / kredi kartı), dekont no.
            </li>
            <li>Tahsilat en eski vadeli taksitten başlayarak dağıtılır; kısmi ödeme olabilir.</li>
            <li>
              Çek / senet alındıysa çek seçin; vadesinde <Nav>Tahsilatlar</Nav> ekranında “tahsil edildi” veya “karşılıksız” işaretleyin. Çek tahsil edilene kadar para sayılmaz.
            </li>
            <li>
              Müşteriye vermek için <Nav>Ödeme planı (PDF)</Nav>.
            </li>
          </ol>
          <Shot eager={print} src="36-sozlesme" alt="Satış sözleşmesi sayfası" />
          <Shot eager={print} src="37-tahsilatlar" alt="Tahsilatlar ekranı" caption="Geciken ve 30 gün içindeki taksitler, portföydeki çekler." />
        </GuideStep>
      </GuideSection>

      {/* 7 */}
      <GuideSection id="takip" title="7. Takip: bütçe, nakit, senaryo">
        <GuideStep n="1" title="Bütçe kontrolü">
          <p>
            <Nav>Bütçe kontrolü</Nav>: her kalem için baz bütçe, gerçekleşen, tamamlanma ve <b>tahmini tamamlanma maliyeti (EAC)</b>. EAC = bugüne kadar harcanan + kalan iş × güncel fiyat. Sapma = baz
            bütçe − EAC; eksi çıkan kalem bütçeyi aşacak demektir. “Yalnızca aşım, risk ve bütçesiz kalemler” kutusu listeyi kısaltır.
          </p>
          <Shot eager={print} src="16-butce-kontrolu" alt="Bütçe kontrolü ekranı" />
        </GuideStep>
        <GuideStep n="2" title="Senaryolar: “ya şöyle olursa?”">
          <p>
            <Nav>Senaryolar</Nav> ekranı hazır duyarlılıkları gösterir: demir %15 artarsa, döviz %20 artarsa, inşaat 3 ay uzarsa, arsa payı %50 olursa. Her birinde maliyet, gelir, kâr ve gereken m²
            fiyatı yan yana görünür. <Nav>Yeni senaryo</Nav> ile kendi iyimser / kötümser senaryonuzu kaydedin.
          </p>
          <Shot eager={print} src="34-senaryolar" alt="Senaryolar ekranı" caption="Alttaki “Kâra en çok etki eden kalemler” listesi neyi yakından izlemeniz gerektiğini gösterir." />
        </GuideStep>
        <GuideStep n="3" title="Portföy ve bildirimler">
          <p>
            <Nav>Portföy</Nav>: tüm projelerin özeti, bu hafta ödenecekler, bağlantı uyarıları. Zil: size düşen işler. Bir bildirime tıklayınca ilgili ekran açılır; iş bitince bildirim kendiliğinden
            kaybolur.
          </p>
          <Shot eager={print} src="40-bildirimler" alt="Portföy ve bildirimler" />
        </GuideStep>
        <GuideStep n="4" title="Raporlar">
          <p>
            <Nav>Raporlar</Nav>: maliyet kalemine, aya, bloğa ve tedarikçiye göre harcamalar; kayıtlar Excel olarak indirilir. Şirket geneli <Nav>Projeler arası raporlar</Nav> projeleri m² maliyeti,
            bütçe, tahmini tamamlanma maliyeti, gelir ve beklenen kârla karşılaştırır.
          </p>
        </GuideStep>
      </GuideSection>

      {/* 8 */}
      <GuideSection id="aysonu" title="8. Ay sonu ve güvenlik">
        <GuideStep n="1" title="Muhasebeci paketi">
          <p>
            <Nav>Muhasebeci paketi</Nav> → dönem seçin (<Nav>Geçen ay</Nav> / <Nav>Bu ay</Nav>) → <Nav>Paketi indir (ZIP)</Nav>. İçinde onaylı fatura listesi (Excel), tedarikçi cari özetleri, avanslar
            ve belge fotoğrafları vardır. Mali müşavirinize e-postayla gönderebilirsiniz.
          </p>
          <Shot eager={print} src="41-muhasebeci" alt="Muhasebeci paketi" />
        </GuideStep>
        <GuideStep n="2" title="Yedekler">
          <p>
            Program açıkken her gün kendiliğinden yedek alır ve son 14 yedeği saklar. <Nav>Ayarlar → Yedekler</Nav> ekranından yedekleri görebilir, <Nav>Şimdi yedek al</Nav> ile hemen yedek alabilir
            ve indirebilirsiniz.
          </p>
          <Shot eager={print} src="42-yedekler" alt="Yedekler ekranı" />
          <Tip tone="warn">
            Haftada bir yedeklerden birini harici diske veya buluta (ör. OneDrive) kopyalayın. Bilgisayar bozulursa yalnızca kopyaladığınız yedek kurtarır. Geri yüklemek için programı kapatıp{" "}
            <Nav>geri-yukle.bat</Nav> dosyasını çalıştırın.
          </Tip>
        </GuideStep>
        <GuideStep n="3" title="Değişiklik geçmişi">
          <p>
            <Nav>Ayarlar → Değişiklik geçmişi</Nav> (yalnızca yönetici): kim, neyi, ne zaman ekledi, değiştirdi, sildi veya onayladı. Proje, kişi ve tarihe göre süzülebilir.
          </p>
        </GuideStep>
      </GuideSection>

      {/* 9 */}
      <GuideSection id="sss" title="9. Sık sorulanlar">
        <div className="grid gap-2">
          <Faq q="Yanlış harcama girdim, nasıl düzeltirim?">
            <p>
              Kaydı açın. Henüz onaylanmadıysa kaydı giren kişi düzeltebilir veya silebilir. Onaylandıysa muhasebe veya yönetici düzeltir. Reddedilen kayıt düzeltilip kaydedilince yeniden onaya gider.
            </p>
          </Faq>
          <Faq q="Malzeme fiyatı değişti, bütçeyi tek tek mi güncelleyeceğim?">
            <p>
              Hayır. Bütçe satırında fiyat “Kütüphane” veya “Reçete” ile verildiyse, kütüphanedeki fiyat değişince (yeni fatura, teklif veya bağlantı) bütçe kendiliğinden güncellenir. “Elle” verilen
              fiyatları siz değiştirirsiniz.
            </p>
          </Faq>
          <Faq q="Satılmış dairenin fiyatı değişir mi?">
            <p>Hayır. Satışta fiyat kilitlenir. Maliyet veya kâr oranı değişince yalnızca satılmamış bölümlerin fiyatı yeniden dağıtılır.</p>
          </Faq>
          <Faq q="Şantiye şefi maliyet veya kâr görebilir mi?">
            <p>Hayır. Şantiye şefi yalnızca kendi projesinde harcama ve malzeme girişi yapar; fiyat listesi, kâr ve bütçe tutarlarını görmez. Satış ekibi de maliyeti görmez.</p>
          </Faq>
          <Faq q="Bir kullanıcı şifresini unuttu.">
            <p>
              Yönetici <Nav>Ayarlar → Kullanıcılar → Düzenle</Nav> ekranında “Yeni şifre” yazıp kaydeder. Kullanıcının açık oturumları kapanır.
            </p>
          </Faq>
          <Faq q="İşten ayrılan kullanıcıyı silmeli miyim?">
            <p>Silmeyin, pasif yapın (kullanıcı düzenleme ekranında “Aktif” işaretini kaldırın). Giriş yapamaz ama girdiği kayıtlar ve geçmişi korunur.</p>
          </Faq>
          <Faq q="Telefonda internet yok, kayıt kaybolur mu?">
            <p>Hayır. Harcama telefonda bekler ve internet gelince kendiliğinden gönderilir. Telefonu sıfırlamadığınız veya tarayıcı verilerini silmediğiniz sürece kaybolmaz.</p>
          </Faq>
          <Faq q="Program açılmıyor veya siyah pencerede hata var.">
            <p>
              Siyah penceredeki mesajın fotoğrafını çekin. Program klasöründeki README dosyasının “Sorun giderme” bölümünde sık hatalar ve çözümleri var. Program klasörünün yolunda Türkçe karakter
              veya boşluk olmamalı (ör. <Nav>C:\insaat</Nav>).
            </p>
          </Faq>
          <Faq q="Bu kılavuzu kağıda / PDF’e nasıl alırım?">
            <p>
              Kılavuz sayfasının üstündeki <Nav>PDF olarak indir</Nav> düğmesi yazdırma sayfasını açar; yazıcı olarak “PDF olarak kaydet”i seçin.
            </p>
          </Faq>
        </div>
      </GuideSection>
    </div>
  );
}
