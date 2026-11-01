// Bağlantı faturalarının bağlantıyla karşılaştırılması (PLAN.md 9.5; saf modül).
import Decimal from "decimal.js";
import { formatNumber } from "../format";
import { roundMoney } from "../expenses/amounts";

export type InvoiceLineInput = { itemId: string; quantity: Decimal; unitPrice: Decimal; vatRate: Decimal };
export type ItemRef = {
  id: string;
  description: string;
  unit: string;
  quantity: Decimal;
  unitPrice: Decimal;
  /** Bu faturadan önce faturalanmış miktar */
  invoiced: Decimal;
  /** Onaylı çekişler */
  drawnApproved: Decimal;
};

export function invoiceAmounts(lines: readonly InvoiceLineInput[]) {
  let net = new Decimal(0);
  let vat = new Decimal(0);
  for (const line of lines) {
    const lineNet = roundMoney(line.quantity.times(line.unitPrice));
    net = net.plus(lineNet);
    vat = vat.plus(roundMoney(lineNet.times(line.vatRate).div(100)));
  }
  return { netAmount: net, vatAmount: vat, totalAmount: net.plus(vat) };
}

/** Fiyat %0,1'den fazla farklıysa uyarı (kuruş yuvarlamalarını saymamak için). */
const PRICE_TOLERANCE = new Decimal("0.001");

/** Fatura satırlarını bağlantıyla karşılaştırır; farklar Türkçe uyarı olarak döner. */
export function invoiceWarnings(lines: readonly InvoiceLineInput[], items: ReadonlyMap<string, ItemRef>): string[] {
  const warnings: string[] = [];
  const thisInvoice = new Map<string, Decimal>();
  for (const line of lines) {
    const item = items.get(line.itemId);
    if (!item) continue;
    if (!item.unitPrice.isZero()) {
      const diff = line.unitPrice.minus(item.unitPrice);
      if (diff.abs().div(item.unitPrice).gt(PRICE_TOLERANCE)) {
        const pct = diff.div(item.unitPrice).times(100);
        warnings.push(
          `${item.description}: faturadaki birim fiyat ${formatNumber(line.unitPrice, 4)}, bağlantı fiyatı ${formatNumber(item.unitPrice, 4)} (%${formatNumber(pct, 1)} ${diff.isPositive() ? "fazla" : "eksik"}).`,
        );
      }
    }
    thisInvoice.set(line.itemId, (thisInvoice.get(line.itemId) ?? new Decimal(0)).plus(line.quantity));
  }
  for (const [itemId, quantity] of thisInvoice) {
    const item = items.get(itemId)!;
    const cumulative = item.invoiced.plus(quantity);
    if (cumulative.gt(item.quantity)) {
      warnings.push(
        `${item.description}: faturalanan toplam ${formatNumber(cumulative, 4)} ${item.unit}, bağlantı miktarı ${formatNumber(item.quantity, 4)} ${item.unit}.`,
      );
    } else if (cumulative.gt(item.drawnApproved)) {
      warnings.push(
        `${item.description}: faturalanan toplam ${formatNumber(cumulative, 4)} ${item.unit}, teslim alınan (onaylı çekiş) ${formatNumber(item.drawnApproved, 4)} ${item.unit}.`,
      );
    }
  }
  return warnings;
}
