// Ekrandaki başlık, özet rakam ve form alanlarının yanında çıkan ⓘ açıklamaları.
// Anahtar, ekranda görünen yazıdır (büyük/küçük harf ve parantez içi önemsiz).
// Dil: inşaat veya muhasebe bilmeyen biri için; "ne" (t), "neden önemli" (w), "örnek" (e).

import type { ReactNode } from "react";

export type GlossaryEntry = { t: string; w?: string; e?: string };

const G: Record<string, GlossaryEntry> = {
  // ── Genel / ekranlar ───────────────────────────────────────────────
  "proje paneli": { t: "Projenin özet ekranı: ne harcandı, bütçe ne durumda, ne satıldı, sırada ne var.", w: "Güne buradan başlayın; büyük düğmeler en sık işlere götürür." },
  portföy: { t: "Tüm projelerin tek ekrandaki özeti: toplam bütçe, harcanan, ödenmemiş borçlar, bu hafta ödenecekler.", w: "Şirketin genel durumunu bir bakışta görmek için." },
  projeler: { t: "Açık ve arşivdeki tüm projelerin listesi." },
  harcamalar: { t: "Projeye yapılan her ödeme veya borçlanma: fatura, fiş, irsaliye, avans, hakediş.", w: "Maliyet takibinin temeli. Girilmeyen harcama hiçbir raporda görünmez." },
  "harcama gir": { t: "Tek bir fiş veya faturayı girme ekranı (telefona uygun).", w: "Fotoğraf + kalem + tutar yeterli; gerisi isteğe bağlı." },
  "toplu harcama girişi": { t: "Çok sayıda faturayı bir seferde girme: Excel tablosu yapıştırma veya e-Fatura XML / ZIP dosyası.", w: "Ay sonunda biriken faturaları tek tek girmek yerine." },
  "malzeme geldi": { t: "Önceden anlaşılmış (bağlantılı) malzemenin şantiyeye teslim kaydı. Miktar ve irsaliye no yeterli; tutar bağlantı fiyatından hesaplanır.", w: "Bağlantıda ne kadar çekildiği, ne kadar kaldığı buradan izlenir." },
  "taşeron & hakediş": { t: "Taşeronlarla yapılan sözleşmeler ve her dönem yapılan işin hesabı (hakediş).", w: "Taşerona ne kadar iş yaptırıldığını, ne ödendiğini ve ne kesildiğini gösterir." },
  hakedişler: { t: "Taşeronun bir dönemde yaptığı işin miktarı × birim fiyatı ve bundan yapılan kesintilerle bulunan ödeme.", w: "Taşerona fazla veya eksik ödeme yapılmasını önler." },
  bütçe: { t: "Binanın tamamını yapmak için tahmin edilen maliyet: her kalem için miktar × birim fiyat.", w: "Satış fiyatının ve kârın hesaplandığı temel. Bütçe yoksa ne kadar kâr edeceğinizi bilemezsiniz.", e: "1.344 m³ beton × 3.200 TL = 4,3 milyon TL." },
  "bütçe kontrolü": { t: "Bütçe ile gerçekte harcananın karşılaştırması; işin sonunda toplam maliyetin ne olacağının tahmini.", w: "Hangi kalemin bütçeyi aşacağını erkenden görürsünüz." },
  "maliyet ağacı": { t: "Tüm harcama türlerinin gruplanmış listesi (ör. 05 Kaba inşaat → 05.04 Beton). Her harcama bir kaleme yazılır.", w: "Paranın nereye gittiğini kalem kalem görmeyi sağlar. Mühendislikte “iş kırılım yapısı” (İKY) denir." },
  "maliyet ağacı şablonu": { t: "Yeni projeler açılırken kopyalanan hazır maliyet kalemleri listesi.", w: "Şirketin kullanmadığı kalemleri burada pasif yaparsanız yeni projeler sade başlar." },
  bloklar: { t: "Projedeki binalar. Her blok için kat adedi, bodrum ve inşaat alanı.", w: "Maliyet m² hesapları blokların inşaat alanına göre yapılır." },
  "bağımsız bölümler": { t: "Satılabilen her birim: daire, dükkân, ofis, depo. Net ve brüt alanı, sahibi (müteahhit / arsa sahibi).", w: "Fiyat listesi, satış ve arsa sahibi payı bu listeye göre çalışır." },
  "arsa & sözleşme": { t: "Arsanın nasıl alındığı (kat karşılığı / satın alma), arsa sahipleri, payları ve arsa ödemeleri.", w: "Kat karşılığında arsa sahibine verilen daireler satılamaz; kârı doğrudan etkiler." },
  metraj: { t: "Bir işin miktarı: kaç m³ beton, kaç ton demir, kaç m² sıva. Bu ekranda alanla çarpılan hazır oranlarla (katsayı) hızlıca bulunur.", w: "Miktar yanlışsa bütçe de yanlış olur.", e: "3.200 m² inşaat alanı × 0,42 m³/m² = 1.344 m³ beton." },
  fiyatlandırma: { t: "Maliyetten satış fiyatına giden hesap: maliyet + kâr + komisyon → m² satış fiyatı → her bölümün fiyatı.", w: "Daireleri kaça satarsanız ne kadar kâr edeceğinizi gösterir." },
  "fiyat listesi": { t: "Her bağımsız bölümün onaylı satış fiyatı. Satış ekibi yalnızca onaylı listeyi görür.", w: "Herkesin aynı fiyatı söylemesini sağlar." },
  satışlar: { t: "Bölümlerin durumu (boş / rezerve / satıldı), müşteriler ve satış sözleşmeleri.", w: "Ne kadar satıldığını ve ne kadar alacak olduğunu gösterir." },
  tahsilatlar: { t: "Müşterilerden gelen ödemeler ve taksit takvimi: geciken, yaklaşan taksitler, çek / senetler.", w: "Geciken parayı zamanında istemek nakit sıkışmasını önler." },
  "nakit akışı": { t: "Ay ay kasaya girecek ve çıkacak para; kasada biriken bakiye.", w: "Kârlı bir proje bile parasız kalabilir. Hangi ay dışarıdan para gerektiğini önceden gösterir." },
  "iş programı": { t: "Hangi işin hangi aylarda yapılacağı (ör. hafriyat 1–2. ay, kaba inşaat 3–12. ay).", w: "Nakit akışı, kalan maliyeti bu aylara dağıtır." },
  senaryolar: { t: "“Ya şöyle olursa?” hesapları: demir zamlanırsa, inşaat uzarsa, satışlar yavaşlarsa kâr ve nakit nasıl değişir.", w: "Riskleri önceden görüp fiyat veya plan değiştirmek için." },
  raporlar: { t: "Harcamaların kaleme, aya, bloğa ve tedarikçiye göre dökümü; Excel olarak indirilir." },
  "harcama raporları": { t: "Harcamaların kaleme, aya, bloğa ve tedarikçiye göre dökümü; Excel olarak indirilir." },
  bağlantılar: { t: "Tedarikçiyle önceden yapılan miktar ve fiyat anlaşmaları (ön alım). Ör. “1.400 m³ betonu 3.150 TL'den alacağız”.", w: "Fiyat artışlarına karşı korur; ne kadar çekildiği ve ne kadar kaldığı buradan izlenir." },
  "yeni malzeme bağlantısı": { t: "Tedarikçiyle yapılan ön alım anlaşmasını kaydetme: malzeme, miktar, birim fiyat ve ödeme planı." },
  "malzeme transferi": { t: "Bir şantiyede artan malzemenin başka projeye gönderilmesi; maliyeti de o projeye aktarılır." },
  tedarikçiler: { t: "Malzeme aldığınız firmalar ve taşeronlar; her birinin cari özeti (ne alındı, ne ödendi)." },
  "vade listesi": { t: "Ödenmemiş tüm borçlar vade sırasıyla: faturalar, bağlantı taksitleri, hakedişler.", w: "Hangi gün ne ödeneceğini bilmek için. Ödeyince “Ödendi” işaretleyin." },
  "ortak fatura": { t: "Birden fazla projeyi ilgilendiren bir faturayı (ör. vinç kirası) projelere bölerek girme." },
  "muhasebeci paketi": { t: "Dönemin onaylı faturaları, tedarikçi özetleri ve belge fotoğrafları tek ZIP dosyasında.", w: "Mali müşavire ay sonunda gönderilir; kâğıt fatura taşımaya gerek kalmaz." },
  kütüphane: { t: "Malzeme, işçilik ve makine fiyatları. Faturalardan gelen fiyatlar buraya kendiliğinden yazılır.", w: "Bütçe bu fiyatları kullanır; fiyat değişince bütçe kendiliğinden güncellenir." },
  "konsolide nakit akışı": { t: "Tüm projelerin nakit akışı tek tabloda; şirketin toplam para ihtiyacı.", w: "Bir projenin fazlası diğerinin açığını kapatabilir mi, görürsünüz." },
  "konsolide nakit": { t: "Tüm projelerin nakit akışı tek tabloda; şirketin toplam para ihtiyacı." },
  "projeler arası karşılaştırma": { t: "Projelerin m² maliyeti, bütçe, gelir ve kârlarının yan yana karşılaştırması.", w: "Hangi projenin neden daha pahalıya mal olduğunu öğrenmek için." },
  ayarlar: { t: "Kullanıcılar, kurlar, vergi oranları, maliyet ağacı şablonu, yedekler." },
  kullanıcılar: { t: "Programı kullanan kişiler, rolleri ve hangi projeleri görebilecekleri." },
  yedekler: { t: "Programın kendiliğinden aldığı günlük yedekler (son 14 gün).", w: "Bilgisayar bozulursa veriyi kurtarmanın tek yolu. Haftada bir harici diske kopyalayın." },
  "değişiklik geçmişi": { t: "Kim, neyi, ne zaman ekledi, değiştirdi, sildi veya onayladı." },
  bildirimler: { t: "Sizi bekleyen işler: onay bekleyen kayıtlar, vadesi gelen ödemeler, geciken taksitler." },
  müşteriler: { t: "Bölüm satın alan veya rezerve eden kişiler; kimlik ve iletişim bilgileri yalnızca satış yetkisi olanlara görünür." },
  "yeni satış": { t: "Bir bölümün satış sözleşmesi ve ödeme planı. Kaydedilince bölümün fiyatı kilitlenir." },
  "yeni taşeron sözleşmesi": { t: "Taşeronla anlaşılan işler, birim fiyatlar ve kesinti oranları (tevkifat, teminat)." },
  "yeni proje": { t: "Proje bilgileri, arsa modeli ve bloklarla yeni proje açma." },
  "excel'den metraj / bütçe": { t: "Keşif listesini veya metraj cetvelini Excel'den toplu olarak bütçeye ekleme." },
  "proje kurulumu": { t: "Yeni projede yapılacak 8 adım. Hepsi bitince bu kutu kendiliğinden kalkar." },

  // ── Bütçe ve maliyet ───────────────────────────────────────────────
  "toplam maliyet": { t: "Binanın tamamının tahmini maliyeti (arsa, ruhsat, inşaat, satış giderleri dahil), KDV hariç.", w: "Kâr = satış geliri − toplam maliyet." },
  "yapım maliyeti": { t: "Yalnızca inşaatın kendisi (04–12 grupları: hafriyat, kaba, ince işler, tesisat, asansör, çevre). Arsa, ruhsat, finansman ve satış giderleri hariç.", w: "Farklı projelerin inşaat verimliliğini karşılaştırmak için." },
  "inşaat m² maliyeti": { t: "Yapım maliyeti ÷ toplam inşaat alanı. 1 m² binayı yapmanın maliyeti.", w: "Piyasadaki “m² maliyeti” konuşmalarında kullanılan rakam budur." },
  "toplam / inşaat m²": { t: "Toplam maliyet ÷ toplam inşaat alanı (arsa ve diğer giderler dahil)." },
  "müteahhit satılabilir m² maliyeti": { t: "Toplam maliyet ÷ müteahhide kalan brüt m². Satacağınız her m²'nin size maliyeti.", w: "Satış fiyatı bu rakamın üstünde olmalı. Kat karşılığında arsa sahibinin dairelerinin maliyeti de size ait olduğu için bu rakam inşaat m² maliyetinden yüksektir.", e: "70,2 milyon TL ÷ 1.575 m² = 44.553 TL/m²." },
  "müteahhit m² maliyeti": { t: "Toplam maliyet ÷ müteahhide kalan brüt m²; satacağınız her m²'nin size maliyeti." },
  gerçekleşen: { t: "Bugüne kadar onaylanmış harcamaların toplamı (KDV hariç).", w: "Bütçeyle karşılaştırılan gerçek rakam." },
  "güncel bütçe": { t: "Bütçenin bugünkü fiyat ve miktarlarla hesaplanmış hali. Fiyat değiştikçe değişir." },
  "baz bütçe": { t: "Belli bir günde dondurulmuş (fotoğrafı çekilmiş) bütçe. Sonraki sapmalar buna göre ölçülür.", w: "Projenin başında “şu kadara mal edeceğiz” dediğiniz rakamı korur." },
  referans: { t: "Karşılaştırmada kullanılan bütçe: baz bütçe varsa o, yoksa güncel bütçe." },
  tamamlanma: { t: "İşin yüzde kaçının bittiği (yapılan işin bütçedeki değeri ÷ toplam bütçe)." },
  "tahmini tamamlanma": { t: "İş bittiğinde toplam maliyetin ne olacağı tahmini: bugüne kadar harcanan + kalan iş × güncel fiyat. İngilizce kısaltması EAC.", w: "Bütçeyi aşıp aşmayacağınızı iş bitmeden gösterir." },
  "tahmini toplam maliyet": { t: "İş bittiğinde toplam maliyetin ne olacağı tahmini: bugüne kadar harcanan + kalan iş × güncel fiyat. İngilizce kısaltması EAC (Estimate at Completion).", w: "Bütçeyi aşıp aşmayacağınızı iş bitmeden gösterir." },
  "tahmini toplam": { t: "İş bittiğinde toplam maliyetin ne olacağı tahmini (EAC): harcanan + kalan iş × güncel fiyat." },
  "hesaplanan miktar": { t: "Katsayı × alan ile bulunan miktar (ör. 0,42 × 3.200 m² = 1.344 m³)." },
  "katsayılı fiyat": { t: "Katsayılar uygulanmış, toplam hedef gelire eşitlenmeden önceki fiyat." },
  sapma: { t: "Bütçe − tahmini tamamlanma maliyeti. Eksi çıkarsa bütçe aşılacak demektir." },
  "bütçe (kdv hariç)": { t: "Projenin güncel bütçesi, KDV hariç." },
  "parametrik katsayılar": { t: "Alanla çarpılınca miktar veren hazır oranlar (ör. her m² inşaat için 0,42 m³ beton).", w: "Proje çizimi bitmeden kaba bir metraj çıkarmanın en hızlı yolu. Projeler biterken gerçekleşen oranla karşılaştırıp öğrenirsiniz." },
  katsayı: { t: "Alanla çarpılan oran. Metrajda: m² başına malzeme miktarı. Fiyatlandırmada: bir bölümün fiyatını artıran / azaltan çarpan (ör. üst kat 1,10)." },
  taban: { t: "Katsayının çarpıldığı alan (inşaat alanı, satılabilir net alan …)." },
  "formül değişkenleri": { t: "Bütçe satırında formülle miktar yazarken kullanılabilecek proje bilgileri (inşaat alanı, bölüm sayısı …)." },
  fire: { t: "Kesim, kırılma, döküm kaybı gibi nedenlerle fazladan alınması gereken malzeme oranı.", e: "Beton %2 fire: 1.000 m³ iş için 1.020 m³ beton alınır." },
  "temin şekli": { t: "İşin nasıl yaptırıldığı: malzemeli taşeron (anahtar teslim), malzeme bizden + taşeron işçilik, ya da tamamen kendi ekibimiz.", w: "Aynı iş için hangi yöntemin ucuz olduğunu karşılaştırmanızı sağlar." },
  reçete: { t: "1 birim işi yapmak için gereken malzeme ve işçilik listesi.", e: "1 m² seramik = 1,05 m² seramik + 5 kg yapıştırıcı + 0,3 kg derz + ustalık." },
  "bütçede kullanılan fiyat": { t: "Bütçede bu malzeme için hangi fiyatın kullanıldığı. Öncelik: geçerli bağlantı → son fatura → teklif → piyasa." },
  "blok bazında maliyet": { t: "Maliyetin bloklara dağılımı. Bloğa ait olmayan ortak giderler blokların inşaat alanı oranında paylaştırılır." },
  "bağlantı kapsaması": { t: "Bütçedeki miktarın ne kadarının bağlantıyla (sabit fiyatla) güvenceye alındığı." },
  "bağlantı kazancı": { t: "(Bugünkü piyasa fiyatı − bağlantı fiyatı) × bağlantı miktarı. Önceden anlaşmanın kazandırdığı para.", e: "(3.650 − 3.150) × 1.400 m³ = 700.000 TL." },

  // ── Bina, arsa ─────────────────────────────────────────────────────
  "inşaat alanı": { t: "Binanın tüm katlarının (bodrum dahil) toplam alanı.", w: "Maliyetin çoğu bu alanla orantılıdır." },
  "satılabilir brüt": { t: "Bağımsız bölümlerin brüt alanlarının toplamı (duvarlar ve ortak alan payı dahil)." },
  "satılabilir net": { t: "Bölümlerin net (içinde yaşanan, duvarlar hariç) alanlarının toplamı." },
  "brüt m²": { t: "Bölümün duvarlar ve ortak alan payı dahil alanı. Tapuda ve fiyatlandırmada genelde bu kullanılır." },
  "net m²": { t: "Bölümün içinde kullanılabilen alan (duvarlar hariç). Satış KDV oranı da net alana göre belirlenir." },
  "müteahhide kalan brüt": { t: "Satılabilir brüt − arsa sahiplerine verilen brüt. Sizin satabileceğiniz alan.", w: "Bütün maliyet bu alana bölünür." },
  "müteahhide kalan brüt m²": { t: "Satılabilir brüt − arsa sahiplerine verilen brüt. Sizin satabileceğiniz alan." },
  "arsa sahiplerine": { t: "Arsa sahiplerine verilecek bölümlerin toplam brüt alanı." },
  "arsa alanı": { t: "Parselin (arsanın) yüzölçümü, tapudaki m²." },
  "emsal (kaks)": { t: "Arsa alanının kaç katı kadar inşaat yapılabileceği (kat alanı katsayısı).", e: "1.200 m² arsa × emsal 2 = 2.400 m² emsal alanı." },
  emsal: { t: "Arsa alanının kaç katı kadar inşaat yapılabileceği (KAKS)." },
  taks: { t: "Binanın zemine oturabileceği alanın arsa alanına oranı (taban alanı katsayısı).", e: "1.200 m² × 0,35 = 420 m² taban oturumu." },
  "arsa modeli": { t: "Arsanın nasıl edinildiği: kat karşılığı (arsa sahibine daire verilir), satın alma (para ödenir) veya karma." },
  "arsa sahipleri": { t: "Kat karşılığı sözleşmesindeki arsa sahipleri, payları ve kira yardımları." },
  "arsa sahipleri payı": { t: "Sözleşmede arsa sahiplerine verilecek alan oranı.", w: "İşaretlenen bölümlerin oranı bununla uyuşmazsa program uyarır." },
  "pay oranı": { t: "Kat karşılığı sözleşmesinde bu arsa sahibine verilecek alan yüzdesi.", e: "%41: satılabilir brüt alanın %41'i arsa sahibine." },
  "aylık kira yardımı": { t: "İnşaat süresince arsa sahibine ödenen aylık kira desteği. Maliyete (01.03) yazılır." },
  "kira yardımı toplamı": { t: "Tüm arsa sahiplerine ödenen aylık kira yardımlarının toplamı." },
  "arsa maliyeti": { t: "Arsa bedeli, tapu masrafları, kira yardımı gibi arsaya bağlı giderler (bütçede 01 grubu)." },
  "arsa ödemeleri ve ödeme planı": { t: "Arsa bedeli taksitleri ve diğer 01 grubu ödemeleri vade sırasıyla." },

  // ── Fiyatlandırma ──────────────────────────────────────────────────
  "fiyatlandırma ayarları": { t: "Kâr oranı, komisyon, yuvarlama ve KDV ayarları. Kaydedince bütün fiyatlar yeniden hesaplanır." },
  "kâr yöntemi": { t: "Kârın nasıl hesaplanacağı. Satış üzerinden marj: satış fiyatının %25'i kâr. Maliyet üzerine ekleme: maliyetin %25 fazlası.", w: "%25 marj, maliyet üzerine yaklaşık %33 eklemeye denk gelir; ikisini karıştırmamak önemli." },
  "hedef marj": { t: "Satış fiyatının yüzde kaçının kâr olarak kalmasını istediğiniz." },
  "emlakçı komisyonu": { t: "Satış fiyatı üzerinden emlakçıya / satış danışmanına ödenecek oran. Fiyata eklenir." },
  "sabit reklam bütçesi": { t: "Reklam ve tanıtım için ayrılan toplam para. Boş bırakılırsa bütçenin 14 (pazarlama) grubundan alınır." },
  "maliyet tabanı": { t: "Fiyatın hangi maliyetten hesaplanacağı: güncel bütçe, tahmini tamamlanma maliyeti veya elle girilen tutar." },
  "yuvarlama adımı": { t: "Fiyatların yuvarlanacağı tutar. 10.000 → 9.873.215 TL, 9.870.000 TL olur." },
  "bahçe / teras alanı oranı": { t: "Bahçe / teras alanının brüt m²'ye hangi oranda ekleneceği (0 = fiyata katılmaz, 0,5 = yarısı)." },
  "m² maliyeti + reklam payı": { t: "Müteahhit satılabilir m² maliyeti + m² başına düşen reklam gideri." },
  "başabaş m² fiyatı": { t: "Kâr sıfır olacak m² satış fiyatı (komisyon dahil).", w: "Bunun altında satmak zarar demektir." },
  "baz m² satış fiyatı": { t: "Kâr ve komisyon eklenmiş, katsayılar uygulanmadan önceki ortalama m² satış fiyatı.", e: "44.553 ÷ (1 − 0,25 − 0,02) = 61.031 TL/m²." },
  "hedef gelir": { t: "Müteahhit bölümlerinin hepsi satılınca hedeflenen toplam gelir (KDV hariç)." },
  karşılık: { t: "Seçili kâr yönteminin diğer yöntemdeki karşılığı (ör. %25 marj = maliyet üzerine %33)." },
  "liste toplamı": { t: "Fiyat listesindeki tüm bölüm fiyatlarının toplamı (yuvarlama sonrası)." },
  komisyon: { t: "Satışlardan emlakçıya ödenecek toplam komisyon." },
  "beklenen kâr": { t: "Tüm bölümler liste fiyatından satılırsa kalacak kâr: gelir − komisyon − maliyet." },
  "kilitli bölümler": { t: "Fiyatı sabitlenmiş bölümlerin (satılmış veya elle kilitlenmiş) toplam fiyatı. Bunlar yeniden hesaplamada değişmez." },
  katsayılar: { t: "Bölüm fiyatını kat, cephe, manzara ve tipe göre artıran / azaltan çarpanlar. 1,00 = etkisiz.", w: "Katsayılar toplam geliri değiştirmez, yalnızca gelirin bölümlere dağılımını değiştirir." },
  "kat katsayısı": { t: "Kata göre fiyat çarpanı. Üst katlar genelde daha değerlidir (ör. 1. kat 0,96, 7. kat 1,10)." },
  "tip katsayısı": { t: "Daire tipine göre fiyat çarpanı (1+1, 2+1, 3+1 …)." },
  "bölüm fiyatları": { t: "Her bölümün KDV hariç ve KDV dahil fiyatı. Katsayılar uygulanıp toplam hedef gelire eşitlenir." },
  "onaylanan fiyat listeleri": { t: "Daha önce onaylanmış fiyat listesi sürümleri. Her onay o günkü maliyet ve oranlarla saklanır." },

  // ── Nakit, senaryo ─────────────────────────────────────────────────
  "toplam giriş": { t: "Dönem boyunca kasaya girecek toplam para: tahsilatlar, taksitler, satış varsayımı." },
  "toplam çıkış": { t: "Dönem boyunca kasadan çıkacak toplam para: harcamalar, hakedişler, bağlantı ödemeleri, kalan maliyet, finansman." },
  "en yüksek nakit ihtiyacı": { t: "Kasanın en çok eksiye düştüğü ay ve tutar.", w: "Bu kadar parayı (özkaynak veya kredi) önceden hazırlamanız gerekir." },
  "finansman maliyeti": { t: "Nakit açığı için kullanılan kredinin faiz gideri." },
  "dönem sonu bakiye": { t: "Proje sonunda kasada kalacak para (başlangıç nakdi dahil)." },
  "varsayımlar": { t: "Nakit akışı hesabında kullanılan tahminler: başlangıç parası, fiyat artışı, faiz, satış hızı, peşinat." },
  "başlangıç nakdi": { t: "Projeye başta ayırdığınız kendi paranız (özkaynak)." },
  "aylık maliyet artışı": { t: "Kalan maliyetin her ay yüzde kaç artacağı tahmini (enflasyon).", w: "Aylık %2 artış, yılda yaklaşık %27 eder; uzun projelerde kârı ciddi düşürür." },
  "kur değişimi": { t: "Döviz kurunun dönem boyunca yüzde kaç değişeceği tahmini. Dövizli kalemleri etkiler." },
  "aylık finansman maliyeti": { t: "Kasa eksiye düştüğünde kullanılan kredinin aylık faiz oranı." },
  "ayda satılacak bölüm": { t: "Satılmamış bölümlerden ayda kaç tane satılacağı tahmini (satış hızı)." },
  "satış başlangıcı": { t: "Satışların projenin kaçıncı ayında başlayacağı." },
  peşinat: { t: "Satışta hemen alınan ilk ödeme." },
  "taksit sayısı": { t: "Peşinattan (ve anahtar teslim / krediden) sonra kalan tutarın bölüneceği taksit sayısı." },
  "kâra en çok etki eden kalemler": { t: "Fiyatı %10 değişince kârı en çok oynatan kalemler.", w: "En çok bunların fiyatını takip edin ve bağlantı yapmayı düşünün." },

  // ── Satın alma, taşeron ────────────────────────────────────────────
  "kalemler ve proje tahsisi": { t: "Bağlantıdaki malzemeler ve miktarın projelere dağılımı. Dağıtılmayan kısım şirket genelinde bekler." },
  tahsis: { t: "Bağlantı miktarının hangi projeye ne kadar ayrıldığı." },
  "çekişler": { t: "Bağlantıdan yapılan teslimatlar (şantiyeye gelen malzeme)." },
  "bağlantı tutarı": { t: "Bağlantının toplam bedeli (miktar × fiyat + KDV)." },
  "teslim alınan": { t: "Bağlantıdan şimdiye kadar teslim alınan malzemenin bedeli." },
  ödenen: { t: "Şimdiye kadar yapılan ödemelerin toplamı." },
  "avans bakiyesi": { t: "Ödenen − teslim alınan. Artıysa tedarikçide alacağınız var, eksiyse borcunuz." },
  "bağlı avanslar": { t: "Bu bağlantı veya sözleşme için önceden ödenen avanslar." },
  "fiyat tipi": { t: "Bağlantı fiyatının nasıl belirlendiği: sabit, dövize bağlı (çekiş veya ödeme günü kuru) ya da belli tarihe kadar sabit." },
  "son çekiş tarihi": { t: "Bağlantıdaki malzemenin en geç hangi tarihe kadar teslim alınabileceği." },
  "geçerlilik sonu": { t: "Bağlantı fiyatının geçerli olduğu son tarih." },
  "kdv tevkifatı": { t: "Faturadaki KDV'nin bir kısmını taşerona ödemeyip devlete sizin yatırmanız (ör. 4/10 = %40).", w: "Oranı işin türüne göre değişir; muhasebecinize teyit ettirin." },
  "teminat kesintisi": { t: "Her hakedişten iş bitene kadar tutulan güvence payı (ör. %5). İş sorunsuz bitince taşerona geri ödenir." },
  "avans mahsup oranı": { t: "Taşerona verilen avansın her hakedişten ne oranda düşüleceği." },
  "avans mahsubu": { t: "Bu hakedişten düşülen avans tutarı." },
  "malzeme mahsubu": { t: "Sizin verdiğiniz ama taşerondan düşülmesi gereken malzemenin bedeli." },
  "kesintiler ve net ödeme": { t: "Hakediş brütüne KDV eklenip tevkifat, teminat, avans ve diğer kesintiler düşülerek bulunan ödenecek tutar." },
  "birim fiyatlar ve ilerleme": { t: "Sözleşmedeki iş kalemleri, birim fiyatları ve şimdiye kadar yapılan miktar." },
  "sözleşme tutarı": { t: "Sözleşmedeki tüm işlerin toplam bedeli (miktar × birim fiyat), KDV hariç." },
  "yapılan iş": { t: "Onaylı hakedişlere göre bugüne kadar yapılan işin brüt bedeli." },
  "net ödenecek / ödenmemiş": { t: "Onaylı hakedişlerin kesintiler sonrası ödenecek toplamı ve henüz ödenmemiş kısmı." },
  "açık avans": { t: "Taşerona verilmiş ama henüz hakedişlerden düşülmemiş avans." },
  "teminat bakiyesi": { t: "Hakedişlerden kesilip tutulan toplam teminat; iş bitince geri ödenir." },
  ilerleme: { t: "Sözleşmedeki işin yüzde kaçının yapıldığı (onaylı hakedişlere göre)." },
  "hakediş şartları": { t: "KDV, tevkifat, teminat ve avans mahsup oranları. Sözleşmeden alınır." },

  // ── Satış, tahsilat ────────────────────────────────────────────────
  boş: { t: "Satışa açık, rezerve edilmemiş bölümler." },
  rezerve: { t: "Bir müşteri için belli bir süre ayrılmış bölüm. Süre dolunca kendiliğinden boşa döner." },
  satıldı: { t: "Satış sözleşmesi yapılmış bölümler. Fiyatları kilitlidir." },
  "arsa sahibi": { t: "Kat karşılığında arsa sahibine verilen bölüm; satışa kapalı." },
  "satış": { t: "Satılan bölümlerin toplam satış fiyatı." },
  "tahsil edilen": { t: "Müşterilerden şimdiye kadar gelen para. Çek / senet tahsil edilene kadar sayılmaz." },
  "kalan alacak": { t: "Satışlardan henüz tahsil edilmemiş tutar." },
  "hedef gelire göre": { t: "Satılanlar + boşların liste fiyatı ile hedef gelir arasındaki fark. Eksiyse hedefin altındasınız." },
  "liste fiyatı": { t: "Onaylı fiyat listesindeki fiyat (KDV hariç)." },
  indirim: { t: "Liste fiyatından yapılan indirim (KDV hariç tutar)." },
  "kapora": { t: "Rezervasyonda müşteriden alınan ön ödeme." },
  "portföydeki çek / senet": { t: "Müşterilerden alınmış, vadesi gelmemiş veya tahsil edilmemiş çek ve senetler." },
  "portföydeki çek / senetler": { t: "Müşterilerden alınmış, vadesi gelmemiş veya tahsil edilmemiş çek ve senetler." },
  "geciken taksitler": { t: "Vadesi geçtiği halde ödenmemiş taksitler.", w: "Müşteriyi hemen arayın; geciken tahsilat nakit açığı demektir." },
  "anahtar teslim ödemesi": { t: "Daire teslim edilirken alınacak ödeme." },
  "banka kredisi": { t: "Müşterinin bankadan çektiği konut kredisiyle ödenecek kısım." },

  // ── Harcama alanları ───────────────────────────────────────────────
  "maliyet kalemi": { t: "Harcamanın hangi işe ait olduğu (ör. 05.04.01 Hazır beton). Yazmaya başlayınca liste daralır.", w: "Doğru kalem seçilmezse bütçe kontrolü yanlış çıkar." },
  "belge türü": { t: "Fatura, fiş, irsaliye, makbuz, hakediş veya belgesiz. Muhasebeciye gidecek paket buna göre hazırlanır." },
  vade: { t: "Ödemenin en geç yapılacağı tarih. Vade listesinde bu tarihe göre sıralanır." },
  "kayıt türü": { t: "Normal harcama, avans, bağlantı çekişi, hakediş veya malzeme transferi." },
  "ödeme şekli": { t: "Nakit, havale / EFT, çek, senet veya kredi kartı." },
  "kdv oranı": { t: "Faturadaki KDV yüzdesi. Oranlar Ayarlar → Parametreler'den gelir." },
  "para birimi": { t: "Tutarın para birimi. Dövizli tutarlar o günün kuruyla TL'ye çevrilir." },
  "bu hafta ödenecekler": { t: "Vadesi geçmiş ve 7 gün içinde vadesi gelen ödemeler." },
  "bağlantı uyarıları": { t: "Son çekiş tarihi yaklaşan, kalanı azalan veya ödemesi yaklaşan bağlantılar." },
  "ödenmemiş": { t: "Henüz ödenmemiş harcama ve avansların KDV dahil toplamı." },
  "toplam harcanan": { t: "Tüm projelerde onaylanmış harcamaların toplamı (KDV hariç)." },
  "toplam bütçe": { t: "Tüm projelerin güncel bütçelerinin toplamı (KDV hariç)." },
};

/** Ekrandaki yazıyı anahtara çevirir: küçük harf, yıldız ve boşluk temizliği. */
function normalize(label: string) {
  return label
    .replace(/[*:]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase("tr-TR");
}

/** Yazıya karşılık gelen açıklama; önce tam hali, sonra parantez içi atılmış hali aranır. */
export function glossaryEntry(label: string | null | undefined): GlossaryEntry | null {
  if (!label) return null;
  const key = normalize(label);
  if (G[key]) return G[key];
  const short = key.replace(/\s*\([^)]*\)\s*/g, " ").replace(/\s+/g, " ").trim();
  return G[short] ?? null;
}

export const GLOSSARY = G;

/** Çocuk düğümlerdeki düz yazıyı toplar (simgeler atlanır); sözlük araması için. */
export function textOf(node: ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  return "";
}
