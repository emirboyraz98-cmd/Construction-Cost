// TCMB günlük kur bülteni (XML) okuma. Ağdan çekme işi sunucudadır; burada yalnızca ayrıştırma var.
// Kaynak: https://www.tcmb.gov.tr/kurlar/today.xml ve /kurlar/YYYYMM/GGAAYYYY.xml
import Decimal from "decimal.js";
import type { Currency } from "@/generated/prisma/enums";

export type TcmbRate = { currency: Exclude<Currency, "TRY">; buying: Decimal; selling: Decimal };
export type TcmbBulletin = { date: Date; rates: TcmbRate[] };

const WANTED: readonly TcmbRate["currency"][] = ["USD", "EUR", "GBP"];

export function tcmbUrl(date: Date | null): string {
  if (!date) return "https://www.tcmb.gov.tr/kurlar/today.xml";
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(date.getUTCDate()).padStart(2, "0");
  return `https://www.tcmb.gov.tr/kurlar/${yyyy}${mm}/${dd}${mm}${yyyy}.xml`;
}

function tagValue(block: string, tag: string): string | null {
  return block.match(new RegExp(`<${tag}>\\s*([^<]*?)\\s*</${tag}>`))?.[1] ?? null;
}

export function parseTcmbXml(xml: string): TcmbBulletin {
  const header = xml.match(/<Tarih_Date[^>]*\sTarih="(\d{2})\.(\d{2})\.(\d{4})"/);
  if (!header) throw new Error("TCMB bülteninde tarih bulunamadı.");
  const date = new Date(Date.UTC(Number(header[3]), Number(header[2]) - 1, Number(header[1])));

  const rates: TcmbRate[] = [];
  for (const match of xml.matchAll(/<Currency\b[^>]*\bCurrencyCode="([A-Z]{3})"[^>]*>([\s\S]*?)<\/Currency>/g)) {
    const code = match[1] as TcmbRate["currency"];
    if (!WANTED.includes(code)) continue;
    const unit = new Decimal(tagValue(match[2], "Unit") || "1");
    const buying = tagValue(match[2], "ForexBuying");
    const selling = tagValue(match[2], "ForexSelling");
    if (!buying || !selling) continue;
    rates.push({ currency: code, buying: new Decimal(buying).div(unit), selling: new Decimal(selling).div(unit) });
  }
  if (rates.length === 0) throw new Error("TCMB bülteninde USD/EUR/GBP kuru bulunamadı.");
  return { date, rates };
}
