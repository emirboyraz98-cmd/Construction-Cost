// Faz 2 formları: bağlantı, tahsis, çekiş, bağlantı ödemesi ve faturası, taşeron sözleşmesi,
// hakediş ve malzeme transferi. Sayılar Türkçe biçimde yazılabilir.
import { z } from "zod";
import {
  ConnectionPriceType,
  ConnectionStatus,
  ContractStatus,
  Currency,
  PaymentMethod,
  SupplyMethod,
} from "@/generated/prisma/enums";
import {
  optionalDate,
  optionalDecimalValue,
  optionalText,
  requiredDate,
  requiredDecimal,
  requiredText,
} from "./fields";

const id = (label: string) => z.string({ error: `${label} seçin.` }).trim().min(1, `${label} seçin.`);

export const connectionItemSchema = z.object({
  id: z.string().optional(),
  description: requiredText("Malzeme", 200),
  costItemCode: id("Maliyet kalemi"),
  unit: requiredText("Birim", 20),
  quantity: requiredDecimal("Miktar", { positive: true }),
  unitPrice: requiredDecimal("Birim fiyat", { min: 0 }),
  vatRate: requiredDecimal("KDV", { min: 0, max: 100 }),
  /** Kütüphane malzemesi (isteğe bağlı): aktif bağlantı fiyatı bütçede öncelikli olur */
  resourceId: z.string().nullable().default(null),
});

export const connectionPaymentSchema = z.object({
  dueDate: requiredDate("Vade"),
  amount: requiredDecimal("Tutar", { positive: true }),
  description: optionalText(200),
  paymentMethod: z.enum(PaymentMethod).nullable(),
  instrumentNo: optionalText(60),
});

export const connectionSchema = z
  .object({
    no: optionalText(40),
    date: requiredDate("Tarih"),
    supplierId: id("Tedarikçi"),
    status: z.enum(ConnectionStatus),
    priceType: z.enum(ConnectionPriceType),
    currency: z.enum(Currency),
    priceFixedUntil: optionalDate(),
    validUntil: optionalDate(),
    lastDrawDate: optionalDate(),
    deliveryPlace: optionalText(200),
    transportIncluded: z.boolean(),
    unloadingIncluded: z.boolean(),
    notes: optionalText(2000),
    items: z.array(connectionItemSchema).min(1, "En az bir kalem girin.").max(100),
    payments: z.array(connectionPaymentSchema).max(120).default([]),
  })
  .superRefine((value, ctx) => {
    if (value.priceType === "FIXED_UNTIL" && !value.priceFixedUntil) {
      ctx.addIssue({ code: "custom", path: ["priceFixedUntil"], message: "Fiyatın sabit kalacağı tarihi seçin." });
    }
    if ((value.priceType === "FX_AT_DELIVERY" || value.priceType === "FX_AT_PAYMENT") && value.currency === "TRY") {
      ctx.addIssue({ code: "custom", path: ["currency"], message: "Döviz bazlı fiyatta para birimi döviz olmalı." });
    }
  });

export type ConnectionInput = z.input<typeof connectionSchema>;
export type ConnectionData = z.output<typeof connectionSchema>;

export const allocationSchema = z.object({
  itemId: id("Kalem"),
  allocations: z.array(z.object({ projectId: id("Proje"), quantity: requiredDecimal("Miktar", { min: 0 }) })).max(50),
});
export type AllocationInput = z.input<typeof allocationSchema>;

export const drawSchema = z.object({
  itemId: id("Bağlantı kalemi"),
  date: requiredDate("Tarih"),
  quantity: requiredDecimal("Miktar", { positive: true }),
  documentNo: optionalText(60),
  blockId: z.string().nullable(),
  description: optionalText(500),
});
export type DrawInput = z.input<typeof drawSchema>;

export const paymentPaidSchema = z.object({
  paidAt: requiredDate("Ödeme tarihi"),
  paymentMethod: z.enum(PaymentMethod).nullable(),
  /** Dövizli bağlantıda ödeme kuru */
  exchangeRate: optionalDecimalValue("Kur"),
});

export const connectionInvoiceSchema = z.object({
  date: requiredDate("Fatura tarihi"),
  documentNo: requiredText("Fatura no", 60),
  exchangeRate: optionalDecimalValue("Kur"),
  notes: optionalText(500),
  lines: z
    .array(
      z.object({
        itemId: id("Kalem"),
        quantity: requiredDecimal("Miktar", { positive: true }),
        unitPrice: requiredDecimal("Birim fiyat", { min: 0 }),
        vatRate: requiredDecimal("KDV", { min: 0, max: 100 }),
      }),
    )
    .min(1, "En az bir satır girin.")
    .max(100),
});
export type ConnectionInvoiceInput = z.input<typeof connectionInvoiceSchema>;

const rate = (label: string) => requiredDecimal(label, { min: 0, max: 100 });

export const contractSchema = z.object({
  no: requiredText("Sözleşme no", 40),
  date: requiredDate("Sözleşme tarihi"),
  supplierId: id("Taşeron"),
  title: requiredText("İş", 200),
  scope: optionalText(2000),
  supplyMethod: z.enum(SupplyMethod),
  vatRate: rate("KDV"),
  vatWithholdingRate: rate("KDV tevkifatı"),
  retentionRate: rate("Teminat kesintisi"),
  advanceOffsetRate: rate("Avans mahsup oranı"),
  status: z.enum(ContractStatus),
  startDate: optionalDate(),
  endDate: optionalDate(),
  notes: optionalText(2000),
  items: z
    .array(
      z.object({
        id: z.string().optional(),
        costItemId: id("Maliyet kalemi"),
        description: requiredText("İş kalemi", 200),
        unit: requiredText("Birim", 20),
        quantity: requiredDecimal("Miktar", { positive: true }),
        unitPrice: requiredDecimal("Birim fiyat", { min: 0 }),
      }),
    )
    .min(1, "En az bir birim fiyat satırı girin.")
    .max(200),
});
export type ContractInput = z.input<typeof contractSchema>;
export type ContractData = z.output<typeof contractSchema>;

export const billingSchema = z.object({
  date: requiredDate("Hakediş tarihi"),
  periodStart: optionalDate(),
  periodEnd: optionalDate(),
  dueDate: optionalDate(),
  lines: z.array(z.object({ contractItemId: id("Kalem"), cumulativeQuantity: requiredDecimal("Kümülatif miktar", { min: 0 }) })).max(200),
  /** Boş: önerilen avans mahsubu kullanılır */
  advanceOffset: optionalDecimalValue("Avans mahsubu"),
  materialOffset: optionalDecimalValue("Malzeme mahsubu"),
  otherDeductions: optionalDecimalValue("Diğer kesintiler"),
  otherDeductionNote: optionalText(300),
  notes: optionalText(1000),
});
export type BillingInput = z.input<typeof billingSchema>;
export type BillingData = z.output<typeof billingSchema>;

export const transferSchema = z
  .object({
    date: requiredDate("Tarih"),
    fromProjectId: id("Gönderen proje"),
    toProjectId: id("Alan proje"),
    description: requiredText("Malzeme", 200),
    costItemCode: id("Maliyet kalemi"),
    quantity: optionalDecimalValue("Miktar"),
    unit: optionalText(20),
    amount: requiredDecimal("Aktarılan tutar", { positive: true }),
    notes: optionalText(500),
  })
  .refine((v) => v.fromProjectId !== v.toProjectId, { path: ["toProjectId"], message: "Gönderen ve alan proje aynı olamaz." });
export type TransferInput = z.input<typeof transferSchema>;
