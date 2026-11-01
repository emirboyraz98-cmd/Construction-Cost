import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL tanımlı değil. Uygulamayı "npm run dev" veya "npm start" ile başlatın.');
  }
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}

function getClient(): PrismaClient {
  // Geliştirmede sıcak yeniden yüklemede bağlantı havuzunun çoğalmaması için tek örnek.
  globalForPrisma.prisma ??= createClient();
  return globalForPrisma.prisma;
}

/** Veritabanı istemcisi; ilk kullanımda bağlanır (derleme sırasında bağlantı açılmaz). */
export const db = new Proxy({} as PrismaClient, {
  get(_target, property) {
    const client = getClient();
    const value = Reflect.get(client, property, client);
    return typeof value === "function" ? value.bind(client) : value;
  },
});

export type Tx = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];
