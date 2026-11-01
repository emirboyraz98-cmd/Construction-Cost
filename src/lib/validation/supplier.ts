import { z } from "zod";
import { SupplierKind } from "@/generated/prisma/enums";
import { optionalText, requiredText } from "./fields";

export const supplierSchema = z.object({
  name: requiredText("Firma / kişi adı", 200),
  taxNumber: z
    .string()
    .optional()
    .transform((value) => value?.replace(/\s/g, "") || null)
    .refine((value) => value == null || /^\d{10,11}$/.test(value), "Vergi no 10, TC kimlik no 11 haneli olmalı."),
  taxOffice: optionalText(100),
  kind: z.enum(SupplierKind),
  phone: optionalText(40),
  email: z
    .string()
    .trim()
    .optional()
    .transform((value) => value || null)
    .pipe(z.email("Geçerli bir e-posta girin.").nullable()),
  address: optionalText(300),
  iban: z
    .string()
    .optional()
    .transform((value) => value?.replace(/\s/g, "").toUpperCase() || null)
    .refine((value) => value == null || /^TR\d{24}$/.test(value), "IBAN TR ile başlamalı ve 26 karakter olmalı."),
  notes: optionalText(1000),
  active: z.boolean().default(true),
});

export type SupplierInput = z.input<typeof supplierSchema>;
export type SupplierData = z.output<typeof supplierSchema>;
