"use client";

import { useState } from "react";
import { FormError, FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAction } from "@/components/use-action";
import { formatNumber } from "@/lib/format";
import { saveCashSettingsAction } from "./actions";

export type CashSettingsView = {
  openingCash: string;
  costVatPercent: string | null;
  defaultVat: string | null;
  monthlyInflationPercent: string;
  fxChangePercent: string;
  monthlyInterestPercent: string;
  salesPerMonth: string;
  salesStartMonth: number | null;
  downPaymentPercent: string;
  installmentMonths: number;
};

const v = (x: string | null) => (x == null ? "" : formatNumber(x, 3));

export function CashSettingsCard({ projectId, settings, canEdit, currentProjectMonth, unsoldCount }: { projectId: string; settings: CashSettingsView; canEdit: boolean; currentProjectMonth: number; unsoldCount: number }) {
  const [form, setForm] = useState({
    openingCash: v(settings.openingCash),
    costVatPercent: v(settings.costVatPercent),
    monthlyInflationPercent: v(settings.monthlyInflationPercent),
    fxChangePercent: v(settings.fxChangePercent),
    monthlyInterestPercent: v(settings.monthlyInterestPercent),
    salesPerMonth: v(settings.salesPerMonth),
    salesStartMonth: settings.salesStartMonth?.toString() ?? "",
    downPaymentPercent: v(settings.downPaymentPercent),
    installmentMonths: settings.installmentMonths.toString(),
  });
  const { run, error, fieldErrors, pending } = useAction();
  const set = (k: keyof typeof form, value: string) => setForm((f) => ({ ...f, [k]: value }));
  const field = (k: keyof typeof form, label: string, hint?: string) => (
    <FormField id={`cf-${k}`} label={label} hint={hint} error={fieldErrors[k]}>
      <Input id={`cf-${k}`} inputMode="decimal" value={form[k]} onChange={(e) => set(k, e.target.value)} />
    </FormField>
  );
  return (
    <Card>
      <CardHeader>
        <CardTitle>Varsayımlar (baz senaryo)</CardTitle>
        <CardDescription>Oranları ekip belirler; boş / sıfır bırakılan varsayım hesaba katılmaz. Senaryolar bu değerlerin üzerine değişiklik yapar.</CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-4">
        <FormError message={error} />
        <fieldset disabled={!canEdit} className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {field("openingCash", "Başlangıç nakdi (TL)", "Proje başında ayrılan özkaynak.")}
          {field("costVatPercent", "Planlanan maliyete KDV (%)", settings.defaultVat ? `Boş = parametredeki genel oran %${formatNumber(settings.defaultVat, 2)}` : "Kalan bütçe KDV hariçtir; nakit için eklenir.")}
          {field("monthlyInflationPercent", "Aylık maliyet artışı (%)", "Kalan maliyete bu aydan itibaren bileşik uygulanır.")}
          {field("fxChangePercent", "Kur değişimi (%)", "Dövizli bütçe satırları, dövizli bağlantı ödemeleri ve dövizli tahsilatlar.")}
          {field("monthlyInterestPercent", "Aylık finansman maliyeti (%)", "Kümülatif nakit açığına uygulanır.")}
          {field("salesPerMonth", "Ayda satılacak bölüm", `${unsoldCount} satılmamış bölüm (liste fiyatıyla).`)}
          {field("salesStartMonth", "Satış başlangıcı (proje ayı)", `Boş = bu ay (${currentProjectMonth}. ay).`)}
          {field("downPaymentPercent", "Peşinat (%)")}
          {field("installmentMonths", "Kalan için taksit sayısı (ay)", "0 = satışta tamamı.")}
        </fieldset>
        {canEdit && (
          <div>
            <Button disabled={pending} onClick={() => run(() => saveCashSettingsAction(projectId, form))}>
              Kaydet ve yeniden hesapla
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
