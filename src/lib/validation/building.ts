// Faz 3 formları: bağımsız bölüm, arsa sahibi, kütüphane kaynağı ve fiyatı, reçete, bütçe satırı, katsayı.
import { z } from "zod";
import {
  BudgetPriceSource,
  CoefficientBasis,
  Currency,
  PriceSource,
  QuantitySource,
  ResourceType,
  SupplyMethod,
  UnitOwner,
  UsageType,
} from "@/generated/prisma/enums";
import { optionalDecimalValue, optionalText, requiredDate, requiredDecimal, requiredText } from "./fields";

const id = (label: string) => z.string({ error: `${label} seçin.` }).trim().min(1, `${label} seçin.`);
const int = (label: string, min: number, max: number) =>
  z.coerce.number({ error: `${label} tam sayı olmalı.` }).int(`${label} tam sayı olmalı.`).min(min, `${label} en az ${min}.`).max(max, `${label} en fazla ${max}.`);

export const unitSchema = z
  .object({
    blockId: id("Blok"),
    floor: int("Kat", -10, 100),
    doorNo: requiredText("Kapı no", 20),
    usageType: z.enum(UsageType),
    layout: optionalText(30),
    netArea: requiredDecimal("Net alan", { positive: true }),
    grossArea: requiredDecimal("Brüt alan", { positive: true }),
    commonAreaShare: optionalDecimalValue("Ortak alan payı"),
    facade: optionalText(30),
    view: optionalText(60),
    extraArea: optionalDecimalValue("Balkon / teras / bahçe"),
    owner: z.enum(UnitOwner),
    landownerId: z.string().nullable(),
    notes: optionalText(500),
  })
  .refine((u) => u.netArea.lte(u.grossArea), { path: ["netArea"], message: "Net alan brütten büyük olamaz." });

export const generateUnitsSchema = z.object({
  blockId: id("Blok"),
  fromFloor: int("İlk kat", -10, 100),
  toFloor: int("Son kat", -10, 100),
  perFloor: int("Kattaki bölüm", 1, 20),
  startNo: int("Başlangıç kapı no", 1, 9999),
  usageType: z.enum(UsageType),
  layout: optionalText(30),
  netArea: requiredDecimal("Net alan", { positive: true }),
  grossArea: requiredDecimal("Brüt alan", { positive: true }),
});

export const landownerSchema = z.object({
  name: requiredText("Ad soyad", 200),
  sharePercent: requiredDecimal("Pay oranı", { min: 0, max: 100 }),
  monthlyRentAid: optionalDecimalValue("Aylık kira yardımı"),
  phone: optionalText(40),
  email: optionalText(120),
  notes: optionalText(1000),
});

export const resourceSchema = z.object({
  code: optionalText(30),
  name: requiredText("Ad", 200),
  type: z.enum(ResourceType),
  category: optionalText(80),
  unit: requiredText("Birim", 20),
  wastePercent: requiredDecimal("Fire", { min: 0, max: 100 }),
  currency: z.enum(Currency),
  spec: optionalText(300),
  defaultSupplierId: z.string().nullable(),
  active: z.boolean(),
});

export const resourcePriceSchema = z.object({
  date: requiredDate("Tarih"),
  price: requiredDecimal("Fiyat", { positive: true }),
  currency: z.enum(Currency),
  source: z.enum(PriceSource),
  supplierId: z.string().nullable(),
  note: optionalText(300),
});

export const recipeSchema = z.object({
  code: requiredText("Kod", 30),
  name: requiredText("Ad", 200),
  unit: requiredText("Birim", 20),
  description: optionalText(1000),
  active: z.boolean(),
  lines: z.array(z.object({ resourceId: id("Kaynak"), quantity: requiredDecimal("Miktar", { positive: true }) })).min(1, "En az bir kaynak ekleyin.").max(60),
});

export const budgetLineSchema = z.object({
  costItemId: id("Maliyet kalemi"),
  blockId: z.string().nullable(),
  description: optionalText(200),
  supplyMethod: z.enum(SupplyMethod).nullable(),
  quantitySource: z.enum(QuantitySource),
  quantity: optionalDecimalValue("Miktar"),
  formula: optionalText(300),
  coefficientId: z.string().nullable(),
  unit: optionalText(20),
  priceSource: z.enum(BudgetPriceSource),
  recipeId: z.string().nullable(),
  resourceId: z.string().nullable(),
  unitPrice: optionalDecimalValue("Birim fiyat"),
  currency: z.enum(Currency),
  wastePercent: requiredDecimal("Fire", { min: 0, max: 100 }),
  priceNote: optionalText(300),
});

export const coefficientSchema = z.object({
  costItemCode: id("Maliyet kalemi"),
  name: requiredText("Ad", 100),
  basis: z.enum(CoefficientBasis),
  coefficient: requiredDecimal("Katsayı", { positive: true }),
  unit: requiredText("Birim", 20),
  note: optionalText(300),
});
