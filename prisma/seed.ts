// Başlangıç verisi (her `npm run dev` başında çalışır, tekrar çalıştırılması güvenlidir):
// 1) Varsayılan İKY şablonu (PLAN.md Bölüm 3) — eksik kalemler eklenir, mevcutlar değiştirilmez.
// 2) Hiç kullanıcı yoksa ilk yönetici hesabı.
// 3) Parametre tablosunda KDV oranı yoksa başlangıç oranları.
import { randomUUID } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { hashPassword } from "../src/lib/auth/password";
import { DEFAULT_COST_TEMPLATE } from "../src/lib/cost-tree/default-template";
import { codeDepth, compareCodes, parentCodeOf } from "../src/lib/cost-tree/tree";

// Test değerleri — gerçek kullanımda .env dosyasında değiştirin ve ilk girişten sonra şifreyi yenileyin.
const DEFAULT_ADMIN = {
  name: "Yönetici",
  email: "yonetici@insaat.local",
  password: "Yonetici.2026",
};

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

async function seedCostTemplate() {
  const existing = await prisma.costItemTemplate.findMany({ select: { id: true, code: true } });
  const idByCode = new Map(existing.map((item) => [item.code, item.id]));

  const missing = DEFAULT_COST_TEMPLATE.filter((item) => !idByCode.has(item.code)).sort(
    (a, b) => codeDepth(a.code) - codeDepth(b.code) || compareCodes(a.code, b.code),
  );
  if (missing.length === 0) return 0;

  const order = new Map(
    [...DEFAULT_COST_TEMPLATE].sort((a, b) => compareCodes(a.code, b.code)).map((item, i) => [item.code, i]),
  );
  const rows = missing.map((item) => {
    const id = randomUUID();
    idByCode.set(item.code, id);
    const parentCode = parentCodeOf(item.code);
    return {
      id,
      parentId: parentCode ? (idByCode.get(parentCode) ?? null) : null,
      code: item.code,
      name: item.name,
      unit: item.unit ?? null,
      description: item.description ?? null,
      sortOrder: order.get(item.code) ?? 0,
    };
  });
  await prisma.costItemTemplate.createMany({ data: rows });
  return rows.length;
}

async function seedAdmin() {
  if ((await prisma.user.count()) > 0) return null;
  const email = (process.env.SEED_ADMIN_EMAIL || DEFAULT_ADMIN.email).trim().toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD || DEFAULT_ADMIN.password;
  await prisma.user.create({
    data: {
      name: process.env.SEED_ADMIN_NAME || DEFAULT_ADMIN.name,
      email,
      passwordHash: await hashPassword(password),
      role: "yonetici",
    },
  });
  return { email, usedDefaultPassword: !process.env.SEED_ADMIN_PASSWORD };
}

/**
 * Harcama girişinde seçilen KDV oranları (Temmuz 2023'ten beri %20 genel, %10 ve %1 indirimli).
 * Parametre tablosuna başlangıç değeri olarak bir kez yazılır; Ayarlar > Parametreler'den
 * değiştirilebilir. Muhasebeciyle teyit edilmelidir.
 */
async function seedVatRates() {
  if ((await prisma.parameter.count({ where: { kind: "kdv_orani" } })) > 0) return 0;
  const year = new Date().getUTCFullYear();
  const rates = [
    { value: "20", description: "Genel oran" },
    { value: "10", description: "İndirimli oran" },
    { value: "1", description: "İndirimli oran" },
    { value: "0", description: "KDV'siz / istisna" },
  ];
  await prisma.parameter.createMany({
    data: rates.map((rate) => ({ year, kind: "kdv_orani", unit: "%", ...rate })),
  });
  return rates.length;
}

/**
 * Bağımsız bölüm satışlarında KDV kuralı (fiyatlandırma). Başlangıç değerleri 1.4.2022 sonrası
 * ruhsatlı konutlar için yaygın uygulamadır (net 150 m²'ye kadar %10, üstü ve ticari %20); ruhsat
 * tarihi, kentsel dönüşüm ve arsa değerine göre farklı olabilir. Muhasebeciyle teyit edilmelidir.
 */
async function seedSaleVat() {
  const year = new Date().getUTCFullYear();
  const rows = [
    { kind: "satis_kdv_konut_indirimli", value: "10", unit: "%", description: "Net alanı sınırın altındaki konut; muhasebeciyle teyit edin" },
    { kind: "satis_kdv_konut_net_sinir", value: "150", unit: "m²", description: "İndirimli oranın uygulandığı en fazla net alan" },
    { kind: "satis_kdv_genel", value: "20", unit: "%", description: "Büyük konut, dükkân, ofis" },
  ];
  let added = 0;
  for (const row of rows) {
    if (await prisma.parameter.count({ where: { kind: row.kind } })) continue;
    await prisma.parameter.create({ data: { year, ...row } });
    added++;
  }
  return added;
}

/**
 * Parametrik metraj katsayı şablonu (PLAN.md Bölüm 6). Değerler PLAN'daki aralıkların ortasıdır
 * ve yalnızca başlangıç varsayımıdır; projede düzenlenir, gerçekleşen katsayılarla kalibre edilir.
 */
async function seedCoefficients() {
  if ((await prisma.parametricCoefficient.count({ where: { projectId: null } })) > 0) return 0;
  const rows = [
    { costItemCode: "05.04.01", name: "Beton", basis: "CONSTRUCTION_AREA", coefficient: "0.42", unit: "m³", note: "PLAN 6: 0,35–0,50 m³ / m² inşaat alanı" },
    { costItemCode: "05.05", name: "Demir", basis: "CONSTRUCTION_AREA", coefficient: "0.042", unit: "ton", note: "PLAN 6: 35–50 kg / m² inşaat alanı" },
    { costItemCode: "05.06", name: "Kalıp", basis: "CONSTRUCTION_AREA", coefficient: "3", unit: "m²", note: "PLAN 6: 2,5–3,5 m² / m² inşaat alanı" },
    { costItemCode: "08.01", name: "İç sıva", basis: "SELLABLE_NET", coefficient: "2.75", unit: "m²", note: "PLAN 6: 2,5–3,0 m² / m² net alan" },
    { costItemCode: "08.08", name: "İç boya", basis: "SELLABLE_NET", coefficient: "2.75", unit: "m²", note: "PLAN 6: 2,5–3,0 m² / m² net alan" },
  ] as const;
  await prisma.parametricCoefficient.createMany({ data: rows.map((row, index) => ({ ...row, sortOrder: index })) });
  return rows.length;
}

async function main() {
  const added = await seedCostTemplate();
  const vat = await seedVatRates();
  const coefficients = await seedCoefficients();
  const saleVat = await seedSaleVat();
  if (saleVat > 0) console.log(`Satış KDV parametreleri eklendi (${saleVat}).`);
  if (coefficients > 0) console.log(`Parametrik katsayı şablonu eklendi (${coefficients} katsayı).`);
  if (vat > 0) console.log(`KDV oranları parametre tablosuna eklendi (${vat} oran).`);
  if (added > 0) console.log(`İKY şablonu: ${added} kalem eklendi.`);

  const admin = await seedAdmin();
  if (admin) {
    console.log(`İlk yönetici hesabı oluşturuldu: ${admin.email}`);
    if (admin.usedDefaultPassword) {
      console.log("Varsayılan test şifresi kullanıldı (README.md). Girişten sonra Ayarlar > Hesabım'dan değiştirin.");
    }
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
