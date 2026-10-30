// Harcama tutarları: matrah, KDV, toplam ve TL karşılıkları (hesap motoru; saf fonksiyonlar).
// Tüm tutarlar kuruşa (2 hane) yuvarlanır; matrah + KDV = toplam eşitliği her zaman korunur.
import Decimal from "decimal.js";

export type AmountInput =
  /** Tek tutar girildi (mobil giriş): KDV dahil veya hariç */
  | { mode: "total"; amount: Decimal; includesVat: boolean; vatRate: Decimal; exchangeRate: Decimal }
  /** Miktar × birim fiyat (birim fiyat KDV hariç) */
  | { mode: "unit"; quantity: Decimal; unitPrice: Decimal; vatRate: Decimal; exchangeRate: Decimal }
  /** Matrah ve KDV tutarı belgede yazdığı gibi (fatura içe aktarma) */
  | { mode: "explicit"; netAmount: Decimal; vatAmount: Decimal; exchangeRate: Decimal };

export type ExpenseAmounts = {
  netAmount: Decimal;
  vatAmount: Decimal;
  totalAmount: Decimal;
  netAmountTry: Decimal;
  vatAmountTry: Decimal;
  totalAmountTry: Decimal;
};

export function roundMoney(value: Decimal): Decimal {
  return value.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}

export function computeExpenseAmounts(input: AmountInput): ExpenseAmounts {
  let net: Decimal;
  let vat: Decimal;
  if (input.mode === "explicit") {
    net = roundMoney(input.netAmount);
    vat = roundMoney(input.vatAmount);
  } else {
    const rate = input.vatRate.div(100);
    if (input.mode === "unit") {
      net = roundMoney(input.quantity.times(input.unitPrice));
      vat = roundMoney(net.times(rate));
    } else if (input.includesVat) {
      const total = roundMoney(input.amount);
      net = roundMoney(total.div(rate.plus(1)));
      vat = total.minus(net);
    } else {
      net = roundMoney(input.amount);
      vat = roundMoney(net.times(rate));
    }
  }
  const netTry = roundMoney(net.times(input.exchangeRate));
  const vatTry = roundMoney(vat.times(input.exchangeRate));
  return {
    netAmount: net,
    vatAmount: vat,
    totalAmount: net.plus(vat),
    netAmountTry: netTry,
    vatAmountTry: vatTry,
    totalAmountTry: netTry.plus(vatTry),
  };
}

/** Belgedeki matrah ve KDV'den oran (yüzde, 2 hane). Matrah 0 ise 0. */
export function impliedVatRate(netAmount: Decimal, vatAmount: Decimal): Decimal {
  if (netAmount.isZero()) return new Decimal(0);
  return vatAmount.div(netAmount).times(100).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}
