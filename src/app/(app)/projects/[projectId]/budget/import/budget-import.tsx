"use client";

import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { CheckCircle2Icon, CircleAlertIcon, LoaderCircleIcon, UploadIcon } from "lucide-react";
import { readSpreadsheetAction } from "@/app/(app)/projects/[projectId]/expenses/batch/actions";
import { FormError } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { BUDGET_FIELD_LABELS, BUDGET_FIELDS, guessBudgetMapping, type BudgetField, type BudgetImportRow } from "@/lib/budget/import";
import { parseDelimited } from "@/lib/expenses/tabular";
import { cn } from "@/lib/utils";
import { checkBudgetImportAction, importBudgetAction, type BudgetRowCheck } from "./actions";

export function BudgetImport({ projectId }: { projectId: string }) {
  const [table, setTable] = useState<string[][] | null>(null);
  const [mapping, setMapping] = useState<(BudgetField | null)[]>([]);
  const [checks, setChecks] = useState<BudgetRowCheck[] | null>(null);
  const [done, setDone] = useState<number | null>(null);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const file = useRef<HTMLInputElement>(null);

  function load(rows: string[][]) {
    if (rows.length < 2) return setError("En az bir başlık ve bir veri satırı gerekli.");
    setError(undefined);
    setTable(rows);
    setMapping(guessBudgetMapping(rows[0]));
    setChecks(null);
  }
  const body = (table ?? []).slice(1).filter((r) => r.some((c) => c.trim()));
  const toRows = (): BudgetImportRow[] =>
    body.map((cells) => {
      const v: BudgetImportRow = {};
      mapping.forEach((f, i) => f && (v[f] = cells[i] ?? ""));
      return v;
    });
  const valid = checks?.filter((c) => c.ok).length ?? 0;

  if (done != null)
    return (
      <Card>
        <CardContent className="flex flex-wrap items-center gap-3 py-6">
          <CheckCircle2Icon className="size-5 text-emerald-600" />
          <span>{done} bütçe satırı eklendi.</span>
          <Button asChild>
            <Link href={`/projects/${projectId}/budget`}>Bütçeye git</Link>
          </Button>
        </CardContent>
      </Card>
    );

  return (
    <div className="grid grid-cols-1 gap-4">
      <FormError message={error} />
      {!table && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Excel / CSV dosyası</CardTitle>
              <CardDescription>Metraj cetvelini seçin. İlk satır başlık olmalı: kalem kodu, açıklama, miktar, birim, birim fiyat (isteğe bağlı), blok (isteğe bağlı).</CardDescription>
            </CardHeader>
            <CardContent>
              <input
                ref={file}
                type="file"
                accept=".xlsx,.csv,.txt"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (!f) return;
                  if (/\.(csv|txt)$/i.test(f.name)) return void f.text().then((t) => load(parseDelimited(t)));
                  const data = new FormData();
                  data.set("file", f);
                  start(async () => {
                    const r = await readSpreadsheetAction(data);
                    if (!r.ok) return setError(r.error);
                    if (!r.sheets.length) return setError("Dosyada dolu sayfa yok.");
                    load(r.sheets[0].rows);
                  });
                }}
              />
              <Button onClick={() => file.current?.click()} disabled={pending}>
                {pending ? <LoaderCircleIcon className="animate-spin" /> : <UploadIcon />}
                Dosya seç
              </Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Excel&apos;den yapıştır</CardTitle>
              <CardDescription>Excel&apos;de satırları başlıklarıyla kopyalayıp buraya yapıştırın.</CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                placeholder="Ctrl+V"
                className="min-h-24 font-mono text-xs"
                onPaste={(e) => {
                  e.preventDefault();
                  load(parseDelimited(e.clipboardData.getData("text/plain")));
                }}
              />
            </CardContent>
          </Card>
        </div>
      )}
      {table && (
        <>
          <Card className="gap-0 overflow-x-auto py-0">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="border-b">
                <tr>
                  <th className="w-8" />
                  {table[0].map((h, i) => (
                    <th key={i} className="px-2 py-2 text-left font-normal">
                      <span className="block truncate text-xs text-muted-foreground">{h}</span>
                      <NativeSelect
                        aria-label={`${i + 1}. sütun`}
                        className="h-8 text-xs"
                        value={mapping[i] ?? ""}
                        onChange={(e) => {
                          setMapping((m) => m.map((x, j) => (j === i ? ((e.target.value || null) as BudgetField | null) : x)));
                          setChecks(null);
                        }}
                      >
                        <option value="">— kullanma —</option>
                        {BUDGET_FIELDS.map((f) => (
                          <option key={f} value={f}>
                            {BUDGET_FIELD_LABELS[f]}
                          </option>
                        ))}
                      </NativeSelect>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {body.slice(0, 200).map((cells, r) => {
                  const c = checks?.[r];
                  return (
                    <tr key={r} className={cn("border-b align-top", c && !c.ok && "bg-red-50")}>
                      <td className="px-2 py-1.5">{c ? c.ok ? <CheckCircle2Icon className="size-4 text-emerald-600" /> : <CircleAlertIcon className="size-4 text-destructive" /> : null}</td>
                      {table[0].map((_, i) => (
                        <td key={i} className="px-2 py-1.5">
                          {cells[i]}
                          {i === 0 && c && (c.errors.length > 0 || c.warnings.length > 0) && <span className={cn("block text-[11px]", c.ok ? "text-amber-800" : "text-destructive")}>{[...c.errors, ...c.warnings].join(" · ")}</span>}
                          {i === 0 && c?.label && <span className="block text-[11px] text-muted-foreground">{c.label}</span>}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
          {body.length > 200 && <p className="text-xs text-muted-foreground">İlk 200 satır gösteriliyor; toplam {body.length} satır kontrol edilir.</p>}
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={() => setTable(null)}>
              Başka dosya
            </Button>
            <Button
              variant="outline"
              disabled={pending}
              onClick={() => {
                if (!mapping.includes("costItem") || !mapping.includes("quantity")) return setError("En az “Maliyet kalemi” ve “Miktar” sütunlarını eşleştirin.");
                setError(undefined);
                start(async () => {
                  const r = await checkBudgetImportAction(projectId, toRows());
                  if (!r.ok) return setError(r.error);
                  setChecks(r.checks);
                });
              }}
            >
              Kontrol et
            </Button>
            <Button
              disabled={pending || !checks || valid === 0}
              onClick={() =>
                start(async () => {
                  const r = await importBudgetAction(projectId, toRows());
                  if (!r.ok) return setError(r.error);
                  setDone(r.count);
                })
              }
            >
              {valid} satırı bütçeye ekle
            </Button>
            {checks && checks.length - valid > 0 && <span className="text-sm text-destructive">{checks.length - valid} hatalı satır atlanacak</span>}
          </div>
        </>
      )}
    </div>
  );
}
