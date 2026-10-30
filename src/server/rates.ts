import "server-only";
import Decimal from "decimal.js";
import type { Currency } from "@/generated/prisma/enums";
import { addDays } from "@/lib/expenses/payables";
import { parseTcmbXml, tcmbUrl, type TcmbBulletin } from "@/lib/expenses/tcmb";
import { ActionError, getAccess, requireGlobalCapability } from "./access";
import { writeAudit } from "./audit";
import { db } from "./db";

export async function listRates(limit = 60) {
  await requireGlobalCapability("rates.manage");
  return db.exchangeRate.findMany({ orderBy: [{ date: "desc" }, { currency: "asc" }], take: limit });
}

/**
 * Harcama tarihindeki kur önerisi: o gün veya en yakın önceki gün (10 güne kadar) kaydedilmiş
 * TCMB döviz alış kuru. Kullanıcı formda değiştirebilir.
 */
export async function suggestedRate(date: Date, currency: Currency) {
  await getAccess();
  if (currency === "TRY") return null;
  const rate = await db.exchangeRate.findFirst({
    where: { currency, date: { lte: date, gte: addDays(date, -10) } },
    orderBy: { date: "desc" },
  });
  return rate ? { value: rate.buying.toString(), date: rate.date, source: rate.source } : null;
}

/** İçe aktarmada satır satır kur bulmak için belirli aralıktaki kurlar. */
export async function ratesBetween(from: Date, to: Date) {
  return db.exchangeRate.findMany({
    where: { date: { gte: addDays(from, -10), lte: to } },
    orderBy: { date: "asc" },
  });
}

export async function saveManualRate(date: Date, currency: Exclude<Currency, "TRY">, buying: Decimal, selling: Decimal) {
  const { user } = await requireGlobalCapability("rates.manage");
  await db.$transaction(async (tx) => {
    const rate = await tx.exchangeRate.upsert({
      where: { date_currency: { date, currency } },
      create: { date, currency, buying, selling, source: "MANUAL" },
      update: { buying, selling, source: "MANUAL" },
    });
    await writeAudit(tx, {
      userId: user.id,
      action: "update",
      entity: "ExchangeRate",
      entityId: rate.id,
      changes: { date: date.toISOString().slice(0, 10), currency, buying: buying.toString(), selling: selling.toString() },
    });
  });
}

async function downloadBulletin(date: Date | null): Promise<TcmbBulletin | null> {
  const response = await fetch(tcmbUrl(date), { signal: AbortSignal.timeout(10_000), cache: "no-store" });
  if (response.status === 404) return null; // hafta sonu / tatil
  if (!response.ok) throw new Error(`TCMB yanıtı: ${response.status}`);
  return parseTcmbXml(await response.text());
}

/**
 * TCMB'den kurları çeker ve kaydeder. Tarih tatile denk gelirse önceki iş günü bülteni kullanılır
 * ve o günün tarihiyle kaydedilir. Elle girilmiş kurların üzerine yazılmaz.
 */
export async function fetchTcmbRates(date: Date | null) {
  const { user } = await getAccess();
  let bulletin: TcmbBulletin | null = null;
  try {
    for (let back = 0; back < 7 && !bulletin; back++) {
      bulletin = await downloadBulletin(date ? addDays(date, -back) : back === 0 ? null : addDays(new Date(), -back));
    }
  } catch (error) {
    console.error(error);
    throw new ActionError("TCMB'ye ulaşılamadı. İnternet bağlantısını kontrol edin veya kuru elle girin.");
  }
  if (!bulletin) throw new ActionError("Bu tarih için TCMB kuru bulunamadı; kuru elle girin.");
  const found = bulletin;

  const saved = await db.$transaction(async (tx) => {
    let count = 0;
    for (const rate of found.rates) {
      const existing = await tx.exchangeRate.findUnique({
        where: { date_currency: { date: found.date, currency: rate.currency } },
      });
      if (existing?.source === "MANUAL") continue;
      await tx.exchangeRate.upsert({
        where: { date_currency: { date: found.date, currency: rate.currency } },
        create: { date: found.date, currency: rate.currency, buying: rate.buying, selling: rate.selling, source: "TCMB" },
        update: { buying: rate.buying, selling: rate.selling, source: "TCMB" },
      });
      count++;
    }
    await writeAudit(tx, {
      userId: user.id,
      action: "import",
      entity: "ExchangeRate",
      changes: { source: "TCMB", date: found.date.toISOString().slice(0, 10), count },
    });
    return count;
  });
  return { date: found.date, count: saved };
}
