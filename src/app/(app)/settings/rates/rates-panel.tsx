"use client";

import { useState, useTransition } from "react";
import { DownloadCloudIcon, LoaderCircleIcon, SaveIcon } from "lucide-react";
import { fetchTcmbAction } from "@/app/(app)/projects/[projectId]/expenses/actions";
import { FormError, FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { formatDateOnly } from "@/lib/format";
import { saveRateAction } from "./actions";

export function RatesPanel({ today }: { today: string }) {
  const [fetchDate, setFetchDate] = useState(today);
  const [manual, setManual] = useState({ date: today, currency: "USD", buying: "", selling: "" });
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>TCMB&apos;den getir</CardTitle>
          <CardDescription>
            Seçilen günün TCMB kurları (USD, EUR, GBP) kaydedilir. Hafta sonu / tatilde önceki iş gününün bülteni alınır.
            Elle girilen kurların üzerine yazılmaz.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-2">
          <FormField id="fetchDate" label="Tarih">
            <Input id="fetchDate" type="date" value={fetchDate} onChange={(e) => setFetchDate(e.target.value)} />
          </FormField>
          <Button
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                setError(undefined);
                const result = await fetchTcmbAction(fetchDate);
                if (!result.ok) setError(result.error);
                else setMessage(`${formatDateOnly(result.date)} TCMB bülteninden ${result.count} kur kaydedildi.`);
              })
            }
          >
            {pending ? <LoaderCircleIcon className="animate-spin" /> : <DownloadCloudIcon />}
            Getir
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Elle kur gir</CardTitle>
          <CardDescription>Aynı gün ve para birimi için kayıtlı kurun yerine geçer.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3">
          <FormField id="rateDate" label="Tarih">
            <Input id="rateDate" type="date" value={manual.date} onChange={(e) => setManual({ ...manual, date: e.target.value })} />
          </FormField>
          <FormField id="rateCurrency" label="Para birimi">
            <NativeSelect id="rateCurrency" value={manual.currency} onChange={(e) => setManual({ ...manual, currency: e.target.value })}>
              <option>USD</option>
              <option>EUR</option>
              <option>GBP</option>
            </NativeSelect>
          </FormField>
          <FormField id="buying" label="Döviz alış (TL)">
            <Input id="buying" inputMode="decimal" value={manual.buying} onChange={(e) => setManual({ ...manual, buying: e.target.value })} />
          </FormField>
          <FormField id="selling" label="Döviz satış (TL)">
            <Input id="selling" inputMode="decimal" value={manual.selling} onChange={(e) => setManual({ ...manual, selling: e.target.value })} />
          </FormField>
          <Button
            className="col-span-2 justify-self-start"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                setError(undefined);
                const result = await saveRateAction(manual);
                if (!result.ok) setError(result.error);
                else setMessage("Kur kaydedildi.");
              })
            }
          >
            <SaveIcon />
            Kaydet
          </Button>
        </CardContent>
      </Card>
      <div className="lg:col-span-2">
        <FormError message={error} />
        {message && <p className="text-sm text-emerald-700">{message}</p>}
      </div>
    </div>
  );
}
