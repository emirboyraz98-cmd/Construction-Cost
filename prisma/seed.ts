// Başlangıç verisi (her `npm run dev` başında çalışır, tekrar çalıştırılması güvenlidir):
// 1) Varsayılan İKY şablonu (PLAN.md Bölüm 3) — eksik kalemler eklenir, mevcutlar değiştirilmez.
// 2) Hiç kullanıcı yoksa ilk yönetici hesabı.
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

async function main() {
  const added = await seedCostTemplate();
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
