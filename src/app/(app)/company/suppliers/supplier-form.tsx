"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { LoaderCircleIcon, SaveIcon } from "lucide-react";
import { FormError, FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import type { SupplierKind } from "@/generated/prisma/enums";
import { SUPPLIER_KIND_LABELS } from "@/lib/expenses/labels";
import { saveSupplierAction } from "./actions";

export type SupplierFormValues = {
  name: string;
  taxNumber: string;
  taxOffice: string;
  kind: SupplierKind;
  phone: string;
  email: string;
  address: string;
  iban: string;
  notes: string;
  active: boolean;
};

export function SupplierForm({ supplierId, initial }: { supplierId: string | null; initial: SupplierFormValues }) {
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const field = (key: Exclude<keyof SupplierFormValues, "kind" | "active">) => ({
    id: key,
    value: values[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setValues({ ...values, [key]: e.target.value }),
    "aria-invalid": errors[key] ? true : undefined,
  });

  return (
    <form
      className="grid max-w-2xl gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        startTransition(async () => {
          const result = await saveSupplierAction(supplierId, values);
          if (result && !result.ok) {
            setError(result.error);
            setErrors(result.fieldErrors ?? {});
          }
        });
      }}
    >
      <FormError message={error} />
      <Card>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <FormField id="name" label="Firma / kişi adı" required error={errors.name} className="sm:col-span-2">
            <Input {...field("name")} maxLength={200} />
          </FormField>
          <FormField id="kind" label="Tür">
            <NativeSelect id="kind" value={values.kind} onChange={(e) => setValues({ ...values, kind: e.target.value as SupplierKind })}>
              {Object.entries(SUPPLIER_KIND_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </NativeSelect>
          </FormField>
          <FormField id="taxNumber" label="Vergi no / TC kimlik no" error={errors.taxNumber}>
            <Input {...field("taxNumber")} inputMode="numeric" />
          </FormField>
          <FormField id="taxOffice" label="Vergi dairesi" error={errors.taxOffice}>
            <Input {...field("taxOffice")} />
          </FormField>
          <FormField id="phone" label="Telefon" error={errors.phone}>
            <Input {...field("phone")} type="tel" />
          </FormField>
          <FormField id="email" label="E-posta" error={errors.email}>
            <Input {...field("email")} type="email" inputMode="email" />
          </FormField>
          <FormField id="iban" label="IBAN" error={errors.iban}>
            <Input {...field("iban")} placeholder="TR.." />
          </FormField>
          <FormField id="address" label="Adres" error={errors.address} className="sm:col-span-2">
            <Input {...field("address")} />
          </FormField>
          <FormField id="notes" label="Notlar" error={errors.notes} className="sm:col-span-2">
            <Textarea {...field("notes")} maxLength={1000} />
          </FormField>
          {supplierId && (
            <Label className="font-normal sm:col-span-2">
              <Checkbox checked={values.active} onCheckedChange={(on) => setValues({ ...values, active: on === true })} />
              Aktif (pasif tedarikçi yeni harcamalarda seçilemez; eski kayıtlar kalır)
            </Label>
          )}
        </CardContent>
      </Card>
      <div className="flex justify-end gap-2">
        <Button asChild variant="outline">
          <Link href={supplierId ? `/company/suppliers/${supplierId}` : "/company/suppliers"}>Vazgeç</Link>
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? <LoaderCircleIcon className="animate-spin" /> : <SaveIcon />}
          Kaydet
        </Button>
      </div>
    </form>
  );
}
