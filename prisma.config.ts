import path from "node:path";
import { defineConfig } from "prisma/config";

// Prisma CLI .env dosyasını kendisi okumaz. `npm run dev` gibi komutlar DATABASE_URL'i
// scripts/with-db.mjs üzerinden zaten verir; doğrudan `npx prisma ...` için .env okunur.
for (const file of [".env.local", ".env"]) {
  try {
    process.loadEnvFile(file);
  } catch {
    // dosya yoksa sorun değil
  }
}

export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
  migrations: {
    path: path.join("prisma", "migrations"),
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // `prisma generate` veritabanı gerektirmez; boş adres yalnızca migrate komutlarında hata verir.
    url: process.env.DATABASE_URL ?? "",
  },
});
