"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CheckCircle2Icon, CopyIcon, LockIcon, LockOpenIcon, PencilIcon } from "lucide-react";
import { FormError, FormField } from "@/components/form-field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { useAction } from "@/components/use-action";
import type { PricingCostBasis, PricingFactorKind, ProfitMethod } from "@/generated/prisma/enums";
import { FLOOR_LABEL, USAGE_TYPE_LABELS } from "@/lib/budget/labels";
import { formatMoney, formatNumber } from "@/lib/format";
import { COST_BASIS_LABELS, FACTOR_KIND_HINTS, FACTOR_KIND_LABELS, PROFIT_METHOD_LABELS } from "@/lib/pricing/labels";
import { cn } from "@/lib/utils";
import { approvePriceListAction, copyFactorsAction, saveFactorsAction, savePricingSettingsAction, setLockedAction, setVatOverrideAction } from "./actions";

const input = (v: string | null | undefined) => (v == null ? "" : formatNumber(v, 4));

export type SettingsView = {
  profitMethod: ProfitMethod;
  profitPercent: string;
  commissionPercent: string;
  advertisingBudget: string | null;
  costBasis: PricingCostBasis;
  manualCost: string | null;
  roundingStep: string;
  extraAreaFactor: string;
  reducedVatEligible: boolean;
};

export function SettingsCard({ projectId, settings, advertisingFromBudget, canEdit }: { projectId: string; settings: SettingsView; advertisingFromBudget: string; canEdit: boolean }) {
  const [form, setForm] = useState({
    profitMethod: settings.profitMethod,
    profitPercent: input(settings.profitPercent),
    commissionPercent: input(settings.commissionPercent),
    advertisingBudget: input(settings.advertisingBudget),
    costBasis: settings.costBasis,
    manualCost: input(settings.manualCost),
    roundingStep: input(settings.roundingStep),
    extraAreaFactor: input(settings.extraAreaFactor),
    reducedVatEligible: settings.reducedVatEligible,
  });
  const { run, error, fieldErrors, pending } = useAction();
  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => setForm((f) => ({ ...f, [key]: value }));
  return (
    <Card>
      <CardHeader>
        <CardTitle>Fiyatlandırma ayarları</CardTitle>
        <CardDescription>Kâr ve komisyon oranlarını ekip belirler; program sabit oran kullanmaz. Değişiklik kaydedilince fiyatlar yeniden hesaplanır.</CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-4">
        <FormError message={error} />
        <fieldset disabled={!canEdit} className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <FormField id="pr-method" label="Kâr yöntemi">
            <NativeSelect id="pr-method" value={form.profitMethod} onChange={(e) => set("profitMethod", e.target.value as ProfitMethod)}>
              {Object.entries(PROFIT_METHOD_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </NativeSelect>
          </FormField>
          <FormField id="pr-profit" label={form.profitMethod === "MARGIN" ? "Hedef marj (%)" : "Maliyet üzerine kâr (%)"} error={fieldErrors.profitPercent}>
            <Input id="pr-profit" inputMode="decimal" value={form.profitPercent} onChange={(e) => set("profitPercent", e.target.value)} />
          </FormField>
          <FormField id="pr-commission" label="Emlakçı komisyonu (%)" error={fieldErrors.commissionPercent} hint="Satış fiyatı üzerinden; fiyata brütleştirilerek eklenir.">
            <Input id="pr-commission" inputMode="decimal" value={form.commissionPercent} onChange={(e) => set("commissionPercent", e.target.value)} />
          </FormField>
          <FormField id="pr-ad" label="Sabit reklam bütçesi (TL)" error={fieldErrors.advertisingBudget} hint={`Boş = bütçenin 14 grubu (14.06 hariç): ${formatMoney(advertisingFromBudget)}`}>
            <Input id="pr-ad" inputMode="decimal" value={form.advertisingBudget} onChange={(e) => set("advertisingBudget", e.target.value)} placeholder="Bütçeden" />
          </FormField>
          <FormField id="pr-basis" label="Maliyet tabanı">
            <NativeSelect id="pr-basis" value={form.costBasis} onChange={(e) => set("costBasis", e.target.value as PricingCostBasis)}>
              {Object.entries(COST_BASIS_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </NativeSelect>
          </FormField>
          {form.costBasis === "MANUAL" && (
            <FormField id="pr-manual" label="Toplam maliyet (TL, reklam ve komisyon hariç)" error={fieldErrors.manualCost}>
              <Input id="pr-manual" inputMode="decimal" value={form.manualCost} onChange={(e) => set("manualCost", e.target.value)} />
            </FormField>
          )}
          <FormField id="pr-round" label="Yuvarlama adımı (TL)" error={fieldErrors.roundingStep} hint="Ör. 10.000 → en yakın 10.000 TL. 0 = kuruş.">
            <Input id="pr-round" inputMode="decimal" value={form.roundingStep} onChange={(e) => set("roundingStep", e.target.value)} />
          </FormField>
          <FormField id="pr-extra" label="Bahçe / teras alanı oranı" error={fieldErrors.extraAreaFactor} hint="Ek alanın brüt m²'ye eklenme oranı (0–1). 0 = fiyata katılmaz.">
            <Input id="pr-extra" inputMode="decimal" value={form.extraAreaFactor} onChange={(e) => set("extraAreaFactor", e.target.value)} />
          </FormField>
          <label className="flex items-start gap-2 text-sm sm:col-span-2">
            <input type="checkbox" className="mt-0.5 size-4" checked={form.reducedVatEligible} onChange={(e) => set("reducedVatEligible", e.target.checked)} />
            <span>
              Konutlar indirimli KDV şartlarını sağlıyor
              <span className="block text-xs text-muted-foreground">Oranlar ve net alan sınırı Ayarlar → Parametreler&apos;den gelir; şartları muhasebecinizle teyit edin.</span>
            </span>
          </label>
        </fieldset>
        {canEdit && (
          <div>
            <Button disabled={pending} onClick={() => run(() => savePricingSettingsAction(projectId, form))}>
              Kaydet ve yeniden hesapla
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export type FactorGroupView = { kind: PricingFactorKind; entries: { key: string; value: string | null; count: number }[] };

function FactorGroup({ projectId, group, canEdit }: { projectId: string; group: FactorGroupView; canEdit: boolean }) {
  const [values, setValues] = useState<Record<string, string>>(Object.fromEntries(group.entries.map((e) => [e.key, input(e.value)])));
  const { run, error, pending } = useAction();
  const label = (key: string) =>
    group.kind === "USAGE" ? USAGE_TYPE_LABELS[key as keyof typeof USAGE_TYPE_LABELS] : group.kind === "FLOOR" ? FLOOR_LABEL(Number(key)) : key || "(boş)";
  return (
    <Card className="gap-3 py-4">
      <CardHeader className="px-4">
        <CardTitle className="text-sm">{FACTOR_KIND_LABELS[group.kind]}</CardTitle>
        <CardDescription className="text-xs">{FACTOR_KIND_HINTS[group.kind]}</CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-2 px-4">
        <FormError message={error} />
        <ul className="grid grid-cols-1 gap-1.5">
          {group.entries.map((e) => (
            <li key={e.key} className="flex items-center justify-between gap-2 text-sm">
              <span className="min-w-0 truncate">
                {label(e.key)} <span className="text-xs text-muted-foreground">· {e.count} bölüm</span>
              </span>
              <Input
                aria-label={`${FACTOR_KIND_LABELS[group.kind]} ${label(e.key)}`}
                className="h-8 w-20 text-right"
                inputMode="decimal"
                placeholder="1,00"
                disabled={!canEdit || (group.kind === "USAGE" && e.key === "RESIDENTIAL")}
                value={values[e.key] ?? ""}
                onChange={(ev) => setValues((v) => ({ ...v, [e.key]: ev.target.value }))}
              />
            </li>
          ))}
        </ul>
        {canEdit && (
          <Button
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() => run(() => saveFactorsAction(projectId, group.kind, Object.entries(values).map(([key, value]) => ({ key, value }))))}
          >
            Kaydet
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

export function FactorTables({ projectId, groups, canEdit, copySources }: { projectId: string; groups: FactorGroupView[]; canEdit: boolean; copySources: { id: string; name: string }[] }) {
  const [source, setSource] = useState("");
  const { run, error, pending } = useAction();
  const visible = groups.filter((g) => g.entries.length > 1 || (g.entries.length === 1 && g.entries[0].key !== "" && g.kind !== "USAGE"));
  return (
    <div className="grid grid-cols-1 gap-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="font-medium">Katsayılar</h2>
          <p className="text-sm text-muted-foreground">Tablolar 1,00 ile başlar. Katsayılar uygulandıktan sonra toplam fiyat hedef gelire eşitlenir (normalizasyon): kârı bozmaz, yalnızca dağılımı değiştirir.</p>
        </div>
        {canEdit && copySources.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <NativeSelect aria-label="Katsayıları kopyalanacak proje" className="w-56" value={source} onChange={(e) => setSource(e.target.value)}>
              <option value="">Önceki projeden kopyala…</option>
              {copySources.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </NativeSelect>
            <Button variant="outline" disabled={!source || pending} onClick={() => confirm("Bu projedeki katsayıların yerine seçilen projeninkiler yazılacak. Devam edilsin mi?") && run(() => copyFactorsAction(projectId, source), () => setSource(""))}>
              <CopyIcon />
              Kopyala
            </Button>
          </div>
        )}
      </div>
      <FormError message={error} />
      {visible.length === 0 ? (
        <p className="text-sm text-muted-foreground">Bölümlerde kat, cephe, manzara veya tip farkı yok; katsayı tablosu oluşmadı.</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {visible.map((g) => (
            <FactorGroup key={`${g.kind}-${g.entries.map((e) => `${e.key}:${e.value}`).join("|")}`} projectId={projectId} group={g} canEdit={canEdit} />
          ))}
        </div>
      )}
    </div>
  );
}

export type PriceRowView = {
  id: string;
  block: string;
  floorLabel: string;
  doorNo: string;
  usage: string;
  layout: string | null;
  facade: string | null;
  view: string | null;
  netArea: string;
  grossArea: string;
  owner: "CONTRACTOR" | "LANDOWNER";
  landowner: string | null;
  baseM2: string | null;
  coefficient: string | null;
  rawPrice: string | null;
  price: string | null;
  perM2: string | null;
  vatRate: string | null;
  vatOverride: string | null;
  priceWithVat: string | null;
  current: string | null;
  change: string | null;
  locked: boolean;
  sold: boolean;
};

export function PriceTable({ projectId, rows, canEdit, canApprove, hasList }: { projectId: string; rows: PriceRowView[]; canEdit: boolean; canApprove: boolean; hasList: boolean }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [vatFor, setVatFor] = useState<PriceRowView | null>(null);
  const [vat, setVat] = useState("");
  const { run, error, fieldErrors, pending } = useAction();
  const contractor = rows.filter((r) => r.owner === "CONTRACTOR");
  const landowner = rows.filter((r) => r.owner === "LANDOWNER");
  const toggle = (id: string) => setSelected((s) => (s.has(id) ? (s.delete(id), new Set(s)) : new Set(s.add(id))));
  const lock = (locked: boolean) => run(() => setLockedAction(projectId, [...selected], locked), () => setSelected(new Set()));

  return (
    <div className="grid grid-cols-1 gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-medium">Bölüm fiyatları</h2>
        {canApprove && (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" disabled={selected.size === 0 || pending} onClick={() => lock(true)}>
              <LockIcon />
              Seçilenleri kilitle
            </Button>
            <Button variant="outline" size="sm" disabled={selected.size === 0 || pending} onClick={() => lock(false)}>
              <LockOpenIcon />
              Kilidi aç
            </Button>
          </div>
        )}
      </div>
      {!vatFor && <FormError message={error} />}
      <Card className="gap-0 overflow-x-auto py-0">
        <table className="w-full min-w-[1080px] text-sm">
          <thead className="border-b text-left text-xs text-muted-foreground">
            <tr>
              {canApprove && <th className="w-10 py-2 pr-2 pl-4" />}
              <th className={cn("py-2 font-medium", !canApprove && "pl-4")}>Bölüm</th>
              <th className="px-2 py-2 text-right font-medium">Net / brüt m²</th>
              <th className="px-2 py-2 text-right font-medium">Baz m²</th>
              <th className="px-2 py-2 text-right font-medium">Katsayı</th>
              <th className="px-2 py-2 text-right font-medium">Normalizasyon öncesi</th>
              <th className="px-2 py-2 text-right font-medium">Fiyat (KDV hariç)</th>
              <th className="px-2 py-2 text-right font-medium">m² fiyatı</th>
              <th className="px-2 py-2 text-right font-medium">KDV</th>
              <th className="px-2 py-2 text-right font-medium">KDV dahil</th>
              {hasList && <th className="px-4 py-2 text-right font-medium">Onaylı liste</th>}
            </tr>
          </thead>
          <tbody>
            {contractor.map((r) => (
              <tr key={r.id} className={cn("border-b", r.locked && "bg-muted/40")}>
                {canApprove && (
                  <td className="py-2 pr-2 pl-4">
                    <input type="checkbox" className="size-4" aria-label={`${r.block} ${r.doorNo} seç`} checked={selected.has(r.id)} onChange={() => toggle(r.id)} />
                  </td>
                )}
                <td className={cn("py-2", !canApprove && "pl-4")}>
                  <span className="flex flex-wrap items-center gap-1.5 font-medium">
                    {r.block} · No {r.doorNo}
                    {r.sold ? (
                      <Badge variant="outline" className="border-emerald-300 bg-emerald-50 text-emerald-800">
                        <LockIcon className="size-3" />
                        Satıldı
                      </Badge>
                    ) : (
                      r.locked && (
                        <Badge variant="outline" className="border-slate-300 bg-slate-50 text-slate-700">
                          <LockIcon className="size-3" />
                          Kilitli
                        </Badge>
                      )
                    )}
                  </span>
                  <span className="block text-xs text-muted-foreground">{[r.floorLabel, r.usage, r.layout, r.facade && `Cephe ${r.facade}`, r.view].filter(Boolean).join(" · ")}</span>
                </td>
                <td className="px-2 py-2 text-right tabular-nums">
                  {formatNumber(r.netArea, 2)} / {formatNumber(r.grossArea, 2)}
                </td>
                <td className="px-2 py-2 text-right tabular-nums">{r.baseM2 ? formatMoney(r.baseM2) : "—"}</td>
                <td className="px-2 py-2 text-right tabular-nums">{r.coefficient ? formatNumber(r.coefficient, 4) : "—"}</td>
                <td className="px-2 py-2 text-right text-muted-foreground tabular-nums">{r.locked ? "—" : r.rawPrice ? formatMoney(r.rawPrice) : "—"}</td>
                <td className="px-2 py-2 text-right font-medium tabular-nums">{r.price ? formatMoney(r.price) : "—"}</td>
                <td className="px-2 py-2 text-right tabular-nums">{r.perM2 ? formatMoney(r.perM2) : "—"}</td>
                <td className="px-2 py-2 text-right whitespace-nowrap tabular-nums">
                  {r.vatRate ? `%${formatNumber(r.vatRate, 2)}` : "—"}
                  {r.vatOverride && <span className="block text-[11px] text-muted-foreground">elle</span>}
                  {canEdit && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-6"
                      aria-label={`${r.doorNo} KDV oranı`}
                      onClick={() => {
                        setVatFor(r);
                        setVat(r.vatOverride ? formatNumber(r.vatOverride, 2) : "");
                      }}
                    >
                      <PencilIcon className="size-3.5" />
                    </Button>
                  )}
                </td>
                <td className="px-2 py-2 text-right tabular-nums">{r.priceWithVat ? formatMoney(r.priceWithVat) : "—"}</td>
                {hasList && (
                  <td className="px-4 py-2 text-right tabular-nums">
                    {r.current ? formatMoney(r.current) : "—"}
                    {r.change && Number(r.change) !== 0 && (
                      <span className={cn("block text-xs", Number(r.change) > 0 ? "text-emerald-700" : "text-destructive")}>
                        {Number(r.change) > 0 ? "+" : ""}%{formatNumber(r.change, 2)}
                      </span>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      {landowner.length > 0 && (
        <p className="text-sm text-muted-foreground">
          Arsa sahibi bölümleri fiyatlanmaz ({landowner.length} bölüm):{" "}
          {landowner.map((r) => `${r.block} No ${r.doorNo}${r.landowner ? ` (${r.landowner})` : ""}`).join(", ")}.
        </p>
      )}
      <Dialog open={vatFor !== null} onOpenChange={(o) => !o && setVatFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Satış KDV oranı</DialogTitle>
            <DialogDescription>
              {vatFor?.block} No {vatFor?.doorNo}. Boş bırakılırsa parametre kuralı uygulanır (kullanım tipi ve net alan sınırına göre).
            </DialogDescription>
          </DialogHeader>
          <FormError message={error} />
          <FormField id="vat-rate" label="KDV oranı (%)" error={fieldErrors._}>
            <Input id="vat-rate" inputMode="decimal" value={vat} onChange={(e) => setVat(e.target.value)} placeholder="Parametreden" />
          </FormField>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVatFor(null)}>
              Vazgeç
            </Button>
            <Button disabled={pending} onClick={() => vatFor && run(() => setVatOverrideAction(projectId, vatFor.id, vat), () => setVatFor(null))}>
              Kaydet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function ApproveButton({ projectId, today, total, requiredChange }: { projectId: string; today: string; total: string; requiredChange: string | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(`Fiyat listesi – ${today}`);
  const [note, setNote] = useState("");
  const { run, error, fieldErrors, pending } = useAction();
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <CheckCircle2Icon />
        Fiyat listesini onayla
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Fiyat listesini onayla</DialogTitle>
            <DialogDescription>
              Toplam {formatMoney(total)} (KDV hariç). Kilitsiz bölümlerin liste fiyatı güncellenir, kilitli bölümler değişmez. Liste sürüm olarak saklanır ve satış ekibi bu listeyi görür.
              {requiredChange && ` Kilitsiz bölümlerde onaylı listeye göre değişim: %${formatNumber(requiredChange, 2)}.`}
            </DialogDescription>
          </DialogHeader>
          <FormError message={error} />
          <FormField id="pl-name" label="Ad" required error={fieldErrors.name}>
            <Input id="pl-name" value={name} onChange={(e) => setName(e.target.value)} />
          </FormField>
          <FormField id="pl-note" label="Not">
            <Input id="pl-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="ör. Satış ofisi açılış listesi" />
          </FormField>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Vazgeç
            </Button>
            <Button
              disabled={pending}
              onClick={() =>
                run(
                  () => approvePriceListAction(projectId, { name, note }),
                  () => {
                    setOpen(false);
                    router.refresh();
                  },
                )
              }
            >
              Onayla
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
