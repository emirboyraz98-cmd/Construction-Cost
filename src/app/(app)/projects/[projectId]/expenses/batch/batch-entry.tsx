"use client";

import Link from "next/link";
import { useMemo, useRef, useState, useTransition } from "react";
import {
  ArrowLeftIcon,
  CheckCircle2Icon,
  CircleAlertIcon,
  ClipboardPasteIcon,
  FileCode2Icon,
  FileSpreadsheetIcon,
  LoaderCircleIcon,
  PlusIcon,
  TableIcon,
  Trash2Icon,
  TriangleAlertIcon,
  UploadIcon,
} from "lucide-react";
import { FormError } from "@/components/form-field";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import type { ImportRow } from "@/lib/expenses/import-rows";
import {
  guessColumnMapping,
  IMPORT_FIELD_LABELS,
  IMPORT_FIELDS,
  parseDelimited,
  type ImportField,
} from "@/lib/expenses/tabular";
import { Decimal, formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import { checkImportAction, commitImportAction, readEInvoicesAction, readSpreadsheetAction, type EInvoiceReport, type RowCheck } from "./actions";

/** Elle (boş tablo) girişte sütunlar. */
const MANUAL_FIELDS: ImportField[] = [
  "date",
  "costItem",
  "supplierName",
  "documentNo",
  "description",
  "totalAmount",
  "vatRate",
  "paymentStatus",
  "dueDate",
];

const WIDE: Partial<Record<ImportField, string>> = {
  costItem: "min-w-56",
  supplierName: "min-w-44",
  description: "min-w-48",
};

let rowKey = 0;
type GridRow = { key: number; values: ImportRow };
const makeRow = (values: ImportRow = {}): GridRow => ({ key: ++rowKey, values });

/** Dosyayı UTF-8, olmazsa Türkçe Windows (1254) kodlamasıyla okur (Excel'in CSV'si). */
async function readText(file: File): Promise<string> {
  const bytes = await file.arrayBuffer();
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder("windows-1254").decode(bytes);
  }
}

export function BatchEntry({
  projectId,
  vatRates,
  costItems,
  suppliers,
}: {
  projectId: string;
  vatRates: { value: string; description: string | null }[];
  costItems: string[];
  suppliers: string[];
}) {
  const [step, setStep] = useState<"source" | "map" | "review" | "done">("source");
  const [raw, setRaw] = useState<string[][]>([]);
  const [sheets, setSheets] = useState<{ name: string; rows: string[][] }[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [hasHeader, setHasHeader] = useState(true);
  const [mapping, setMapping] = useState<(ImportField | null)[]>([]);
  const [fields, setFields] = useState<ImportField[]>(MANUAL_FIELDS);
  const [rows, setRows] = useState<GridRow[]>([]);
  const [checks, setChecks] = useState<Map<number, RowCheck>>(new Map());
  const [defaultVat, setDefaultVat] = useState(vatRates[0]?.value ?? "20");
  const [skipInvalid, setSkipInvalid] = useState(false);
  const [error, setError] = useState<string>();
  const [result, setResult] = useState<{ count: number; newSuppliers: number; skipped: number } | null>(null);
  const [pending, startTransition] = useTransition();
  const fileInput = useRef<HTMLInputElement>(null);
  const xmlInput = useRef<HTMLInputElement>(null);
  const [xmlMode, setXmlMode] = useState<"lines" | "invoice">("lines");
  const [reports, setReports] = useState<EInvoiceReport[]>([]);

  function onEInvoices(list: FileList | null) {
    if (!list || list.length === 0) return;
    setError(undefined);
    const data = new FormData();
    data.set("mode", xmlMode);
    for (const f of Array.from(list)) data.append("files", f);
    startTransition(async () => {
      const response = await readEInvoicesAction(projectId, data);
      if (!response.ok) {
        setError(response.error);
        return;
      }
      setReports(response.reports);
      if (response.rows.length === 0) {
        setError("Okunabilen fatura bulunamadı.");
        return;
      }
      const present = IMPORT_FIELDS.filter((f) => response.rows.some((r) => r[f]));
      setFields(present.includes("costItem") ? present : (["date", "costItem", ...present.filter((f) => f !== "date")] as ImportField[]));
      setRows(response.rows.map((r) => makeRow(r)));
      setFileName(`${response.reports.filter((r) => !r.error).length} e-Fatura`);
      setChecks(new Map());
      setStep("review");
    });
  }

  function loadTable(table: string[][], name: string | null) {
    if (table.length === 0) {
      setError("Tabloda veri bulunamadı.");
      return;
    }
    setError(undefined);
    setRaw(table);
    setFileName(name);
    const guess = guessColumnMapping(table[0]);
    const header = guess.filter(Boolean).length >= 2;
    setHasHeader(header);
    setMapping(header ? guess : table[0].map(() => null));
    setStep("map");
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    setError(undefined);
    if (/\.(csv|txt|tsv)$/i.test(file.name)) {
      loadTable(parseDelimited(await readText(file)), file.name);
      return;
    }
    const data = new FormData();
    data.set("file", file);
    startTransition(async () => {
      const response = await readSpreadsheetAction(data);
      if (!response.ok) {
        setError(response.error);
        return;
      }
      if (response.sheets.length === 0) {
        setError("Dosyada dolu sayfa yok.");
        return;
      }
      setSheets(response.sheets);
      loadTable(response.sheets[0].rows, file.name);
    });
  }

  function applyMapping() {
    const used = mapping.filter((m): m is ImportField => m !== null);
    if (!used.includes("date") || !used.includes("costItem")) {
      setError("En az “Tarih” ve “Maliyet kalemi” sütunlarını eşleştirin.");
      return;
    }
    if (!used.some((f) => ["netAmount", "totalAmount", "unitPrice"].includes(f))) {
      setError("Tutar için “Matrah”, “Toplam” veya “Birim fiyat” sütunlarından birini eşleştirin.");
      return;
    }
    setError(undefined);
    const ordered = IMPORT_FIELDS.filter((f) => used.includes(f));
    setFields(ordered);
    const body = hasHeader ? raw.slice(1) : raw;
    setRows(
      body.map((cells) => {
        const values: ImportRow = {};
        mapping.forEach((field, column) => {
          if (field) values[field] = cells[column] ?? "";
        });
        return makeRow(values);
      }),
    );
    setChecks(new Map());
    setStep("review");
  }

  function startManual() {
    setFields(MANUAL_FIELDS);
    setRows(Array.from({ length: 8 }, () => makeRow()));
    setFileName(null);
    setChecks(new Map());
    setStep("review");
  }

  function setCell(key: number, field: ImportField, value: string) {
    setRows((current) => current.map((row) => (row.key === key ? { ...row, values: { ...row.values, [field]: value } } : row)));
    setChecks((current) => {
      if (!current.has(key)) return current;
      const next = new Map(current);
      next.delete(key);
      return next;
    });
  }

  /** Excel'den kopyalanan bloğu, tıklanan hücreden başlayarak tabloya yayar. */
  function onPaste(event: React.ClipboardEvent, rowIndex: number, field: ImportField) {
    const text = event.clipboardData.getData("text/plain");
    if (!text.includes("\t") && !text.includes("\n")) return;
    event.preventDefault();
    const block = text.replace(/\r/g, "").replace(/\n$/, "").split("\n").map((line) => line.split("\t"));
    const startColumn = fields.indexOf(field);
    setRows((current) => {
      const next = [...current];
      block.forEach((cells, i) => {
        const index = rowIndex + i;
        if (!next[index]) next[index] = makeRow();
        const values = { ...next[index].values };
        cells.forEach((cell, j) => {
          const target = fields[startColumn + j];
          if (target) values[target] = cell.trim();
        });
        next[index] = { ...next[index], values };
      });
      return next;
    });
    setChecks(new Map());
  }

  const filledRows = useMemo(() => rows.filter((row) => Object.values(row.values).some((v) => v?.trim())), [rows]);
  const checkedCount = filledRows.filter((row) => checks.has(row.key)).length;
  const invalidCount = filledRows.filter((row) => checks.get(row.key)?.ok === false).length;
  const validTotal = filledRows.reduce((sum, row) => {
    const total = checks.get(row.key)?.totalTry;
    return total ? sum.plus(total) : sum;
  }, new Decimal(0));

  function check() {
    setError(undefined);
    startTransition(async () => {
      const response = await checkImportAction(projectId, filledRows.map((r) => r.values), defaultVat);
      if (!response.ok) {
        setError(response.error);
        return;
      }
      setChecks(new Map(filledRows.map((row, index) => [row.key, response.checks[index]])));
    });
  }

  function commit() {
    setError(undefined);
    startTransition(async () => {
      const response = await commitImportAction(projectId, filledRows.map((r) => r.values), defaultVat, fileName, skipInvalid);
      if (!response.ok) {
        setError(response.error);
        return;
      }
      setResult({ count: response.count, newSuppliers: response.newSuppliers, skipped: response.skipped });
      setStep("done");
    });
  }

  if (step === "done" && result) {
    return (
      <Card className="max-w-xl">
        <CardContent className="grid gap-3">
          <p className="flex items-center gap-2 font-medium text-emerald-700">
            <CheckCircle2Icon className="size-5" />
            {result.count} harcama aktarıldı.
          </p>
          {result.newSuppliers > 0 && <p className="text-sm">{result.newSuppliers} yeni tedarikçi oluşturuldu.</p>}
          {result.skipped > 0 && <p className="text-sm text-amber-700">{result.skipped} hatalı satır atlandı.</p>}
          <div className="flex gap-2">
            <Button asChild>
              <Link href={`/projects/${projectId}/expenses`}>Harcamalara git</Link>
            </Button>
            <Button variant="outline" onClick={() => { setStep("source"); setRows([]); setResult(null); }}>
              Yeni toplu giriş
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4">
      <FormError message={error} />

      {step === "source" && (
        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileSpreadsheetIcon className="size-5" /> Excel / CSV dosyası
              </CardTitle>
              <CardDescription>Fatura listenizi (.xlsx veya .csv) seçin; sütunları sonra eşleştirirsiniz.</CardDescription>
            </CardHeader>
            <CardContent>
              <input
                ref={fileInput}
                type="file"
                accept=".xlsx,.csv,.txt,.tsv"
                className="hidden"
                onChange={(e) => {
                  void onFile(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
              <Button onClick={() => fileInput.current?.click()} disabled={pending}>
                {pending ? <LoaderCircleIcon className="animate-spin" /> : <UploadIcon />}
                Dosya seç
              </Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileCode2Icon className="size-5" /> e-Fatura / e-Arşiv (XML)
              </CardTitle>
              <CardDescription>GİB portalından veya entegratörden indirilen XML dosyaları ya da ZIP. Birden fazla seçilebilir; maliyet kalemini tabloda seçersiniz.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              <NativeSelect aria-label="e-Fatura satırları" value={xmlMode} onChange={(e) => setXmlMode(e.target.value as "lines" | "invoice")}>
                <option value="lines">Her fatura kalemi ayrı satır</option>
                <option value="invoice">Fatura başına tek satır (KDV oranına göre)</option>
              </NativeSelect>
              <input
                ref={xmlInput}
                type="file"
                multiple
                accept=".xml,.zip,application/xml,text/xml,application/zip"
                className="hidden"
                onChange={(e) => {
                  onEInvoices(e.target.files);
                  e.target.value = "";
                }}
              />
              <div>
                <Button variant="outline" onClick={() => xmlInput.current?.click()} disabled={pending}>
                  {pending ? <LoaderCircleIcon className="animate-spin" /> : <UploadIcon />}
                  XML / ZIP seç
                </Button>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ClipboardPasteIcon className="size-5" /> Excel&apos;den yapıştır
              </CardTitle>
              <CardDescription>Excel&apos;de satırları (başlıklarla birlikte) kopyalayın, buraya yapıştırın.</CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                placeholder="Ctrl+V"
                className="min-h-24 font-mono text-xs"
                onPaste={(event) => {
                  const text = event.clipboardData.getData("text/plain");
                  event.preventDefault();
                  loadTable(parseDelimited(text), null);
                }}
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TableIcon className="size-5" /> Tablo modu
              </CardTitle>
              <CardDescription>Boş tabloda satır satır yazın (Excel&apos;den hücre bloğu da yapıştırılabilir).</CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" onClick={startManual}>
                Boş tablo ile başla
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {step === "map" && (
        <Card>
          <CardHeader>
            <CardTitle>Sütunları eşleştirin</CardTitle>
            <CardDescription>
              {fileName ?? "Yapıştırılan tablo"} · {raw.length} satır. Başlıklardan tahmin edildi; gerekirse değiştirin.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <div className="flex flex-wrap items-center gap-4">
              {sheets.length > 1 && (
                <Label className="font-normal">
                  Sayfa
                  <NativeSelect
                    className="w-48"
                    onChange={(e) => loadTable(sheets.find((s) => s.name === e.target.value)?.rows ?? [], fileName)}
                  >
                    {sheets.map((sheet) => (
                      <option key={sheet.name}>{sheet.name}</option>
                    ))}
                  </NativeSelect>
                </Label>
              )}
              <Label className="font-normal">
                <Checkbox checked={hasHeader} onCheckedChange={(on) => setHasHeader(on === true)} />
                İlk satır başlık
              </Label>
            </div>
            <div className="overflow-x-auto rounded-md border">
              <table className="text-xs">
                <thead>
                  <tr>
                    {mapping.map((field, column) => (
                      <th key={column} className="border-b p-1.5 text-left font-normal">
                        <NativeSelect
                          aria-label={`${column + 1}. sütun`}
                          value={field ?? ""}
                          className="min-w-40"
                          onChange={(e) => {
                            const value = (e.target.value || null) as ImportField | null;
                            setMapping((current) => current.map((f, i) => (i === column ? value : f === value && value ? null : f)));
                          }}
                        >
                          <option value="">— Kullanma —</option>
                          {IMPORT_FIELDS.map((f) => (
                            <option key={f} value={f}>
                              {IMPORT_FIELD_LABELS[f]}
                            </option>
                          ))}
                        </NativeSelect>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {raw.slice(0, 8).map((cells, rowIndex) => (
                    <tr key={rowIndex} className={cn(rowIndex === 0 && hasHeader && "bg-muted font-medium")}>
                      {mapping.map((_, column) => (
                        <td key={column} className="max-w-48 truncate border-b px-2 py-1">
                          {cells[column]}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep("source")}>
                <ArrowLeftIcon />
                Geri
              </Button>
              <Button onClick={applyMapping}>Devam</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === "review" && (
        <>
          {reports.length > 0 && (
            <Card className="gap-2 py-4">
              <CardHeader className="px-4">
                <CardTitle className="text-sm">Okunan e-Faturalar ({reports.filter((r) => !r.error).length} / {reports.length})</CardTitle>
                <CardDescription className="text-xs">Maliyet kalemi, tedarikçinin bu projede son kullandığı kalemden önerildi; kontrol edin. Aynı tedarikçi + belge no zaten kayıtlıysa satır mükerrer olarak işaretlenir.</CardDescription>
              </CardHeader>
              <CardContent className="px-4">
                <ul className="grid grid-cols-1 gap-1 text-xs">
                  {reports.map((r, i) => (
                    <li key={i} className={cn("flex flex-wrap gap-x-2", r.error ? "text-destructive" : r.warnings.length ? "text-amber-800" : "text-muted-foreground")}>
                      <span className="font-medium">{r.number ?? r.file}</span>
                      {r.supplier && <span>{r.supplier}</span>}
                      {r.total && <span className="tabular-nums">{formatMoney(r.total)}</span>}
                      {r.lines > 0 && <span>{r.lines} kalem</span>}
                      {r.error && <span>{r.error}</span>}
                      {r.warnings.map((w) => (
                        <span key={w}>{w}</span>
                      ))}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
          <div className="flex flex-wrap items-end gap-3">
            <Label className="font-normal">
              Varsayılan KDV oranı
              <NativeSelect value={defaultVat} onChange={(e) => setDefaultVat(e.target.value)} className="w-28">
                {vatRates.map((rate) => (
                  <option key={rate.value} value={rate.value}>
                    %{rate.value}
                  </option>
                ))}
              </NativeSelect>
            </Label>
            <p className="text-xs text-muted-foreground">
              Satırda KDV oranı veya KDV tutarı yoksa kullanılır. Kalem için kod (05.04.01) veya ad yazın.
            </p>
          </div>

          <datalist id="cost-item-list">
            {costItems.map((item) => (
              <option key={item} value={item} />
            ))}
          </datalist>
          <datalist id="supplier-list">
            {suppliers.map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>

          <div className="overflow-x-auto rounded-lg border bg-card">
            <table className="w-full text-sm">
              <thead className="bg-muted/60">
                <tr>
                  <th className="w-8 px-2 py-2 text-left font-medium">#</th>
                  {fields.map((field) => (
                    <th key={field} className="px-1 py-2 text-left font-medium whitespace-nowrap">
                      {IMPORT_FIELD_LABELS[field]}
                    </th>
                  ))}
                  <th className="min-w-56 px-2 py-2 text-left font-medium">Kontrol</th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody>
                {rows.map((row, rowIndex) => {
                  const status = checks.get(row.key);
                  return (
                    <tr key={row.key} className={cn("border-t align-top", status?.ok === false && "bg-red-50/60")}>
                      <td className="px-2 py-1.5 text-xs text-muted-foreground">{rowIndex + 1}</td>
                      {fields.map((field) => (
                        <td key={field} className="p-0.5">
                          <input
                            value={row.values[field] ?? ""}
                            onChange={(e) => setCell(row.key, field, e.target.value)}
                            onPaste={(e) => onPaste(e, rowIndex, field)}
                            list={field === "costItem" ? "cost-item-list" : field === "supplierName" ? "supplier-list" : undefined}
                            aria-label={`${rowIndex + 1}. satır ${IMPORT_FIELD_LABELS[field]}`}
                            className={cn(
                              "h-8 w-full min-w-24 rounded border border-transparent bg-transparent px-1.5 text-sm outline-none hover:border-input focus:border-ring focus:bg-background",
                              WIDE[field],
                            )}
                          />
                        </td>
                      ))}
                      <td className="px-2 py-1.5 text-xs">
                        {status?.ok && (
                          <span className="flex items-start gap-1 text-emerald-700">
                            <CheckCircle2Icon className="mt-0.5 size-3.5 shrink-0" />
                            <span>
                              {formatMoney(status.totalTry)} · {status.summary}
                            </span>
                          </span>
                        )}
                        {status?.errors.map((message) => (
                          <span key={message} className="flex items-start gap-1 text-destructive">
                            <CircleAlertIcon className="mt-0.5 size-3.5 shrink-0" />
                            {message}
                          </span>
                        ))}
                        {status?.warnings.map((message) => (
                          <span key={message} className="flex items-start gap-1 text-amber-700">
                            <TriangleAlertIcon className="mt-0.5 size-3.5 shrink-0" />
                            {message}
                          </span>
                        ))}
                      </td>
                      <td className="p-0.5">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`${rowIndex + 1}. satırı sil`}
                          onClick={() => setRows((current) => current.filter((r) => r.key !== row.key))}
                        >
                          <Trash2Icon />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button variant="outline" onClick={() => setRows((current) => [...current, ...Array.from({ length: 5 }, () => makeRow())])}>
              <PlusIcon />5 satır ekle
            </Button>
            <Button variant="outline" onClick={() => setStep("source")}>
              Baştan başla
            </Button>
          </div>

          <Card className="py-4">
            <CardContent className="flex flex-wrap items-center gap-4">
              <span className="text-sm">
                {filledRows.length} dolu satır
                {checkedCount > 0 && (
                  <>
                    {" "}· <span className="text-emerald-700">{checkedCount - invalidCount} geçerli</span>
                    {invalidCount > 0 && <span className="text-destructive"> · {invalidCount} hatalı</span>}
                    {" "}· toplam {formatMoney(validTotal)}
                  </>
                )}
              </span>
              <Button variant="outline" onClick={check} disabled={pending || filledRows.length === 0}>
                {pending ? <LoaderCircleIcon className="animate-spin" /> : <CheckCircle2Icon />}
                Kontrol et
              </Button>
              {invalidCount > 0 && (
                <Label className="font-normal">
                  <Checkbox checked={skipInvalid} onCheckedChange={(on) => setSkipInvalid(on === true)} />
                  Hatalı satırları atla
                </Label>
              )}
              <Button
                onClick={commit}
                disabled={pending || checkedCount !== filledRows.length || filledRows.length === 0 || (invalidCount > 0 && !skipInvalid) || invalidCount === filledRows.length}
              >
                {checkedCount - invalidCount} satırı aktar
              </Button>
            </CardContent>
          </Card>
          {checkedCount !== filledRows.length && filledRows.length > 0 && (
            <Alert>
              <AlertDescription>Aktarmadan önce “Kontrol et” ile satırları doğrulayın (değişen satırlar yeniden kontrol edilir).</AlertDescription>
            </Alert>
          )}
        </>
      )}
    </div>
  );
}
