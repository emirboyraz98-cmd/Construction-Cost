"use client";

import { useState } from "react";
import { LayersIcon, PencilIcon, PlusIcon, Trash2Icon, UserIcon } from "lucide-react";
import { FormError, FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAction } from "@/components/use-action";
import type { UnitOwner, UsageType } from "@/generated/prisma/enums";
import { FLOOR_LABEL, UNIT_OWNER_LABELS, USAGE_TYPE_LABELS } from "@/lib/budget/labels";
import { Decimal, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { deleteUnitsAction, generateUnitsAction, saveUnitAction, setUnitsOwnerAction } from "./actions";

export type UnitView = {
  id: string;
  blockId: string;
  floor: number;
  doorNo: string;
  usageType: UsageType;
  layout: string | null;
  netArea: string;
  grossArea: string;
  commonAreaShare: string | null;
  facade: string | null;
  view: string | null;
  extraArea: string | null;
  owner: UnitOwner;
  landownerId: string | null;
  landownerName: string | null;
  notes: string | null;
};

type Block = { id: string; name: string; constructionArea: string | null };
type Landowner = { id: string; name: string };

type UnitForm = {
  blockId: string;
  floor: string;
  doorNo: string;
  usageType: UsageType;
  layout: string;
  netArea: string;
  grossArea: string;
  commonAreaShare: string;
  facade: string;
  view: string;
  extraArea: string;
  owner: UnitOwner;
  landownerId: string;
  notes: string;
};

const toForm = (u: UnitView): UnitForm => ({
  blockId: u.blockId,
  floor: String(u.floor),
  doorNo: u.doorNo,
  usageType: u.usageType,
  layout: u.layout ?? "",
  netArea: formatNumber(u.netArea),
  grossArea: formatNumber(u.grossArea),
  commonAreaShare: u.commonAreaShare ? formatNumber(u.commonAreaShare) : "",
  facade: u.facade ?? "",
  view: u.view ?? "",
  extraArea: u.extraArea ? formatNumber(u.extraArea) : "",
  owner: u.owner,
  landownerId: u.landownerId ?? "",
  notes: u.notes ?? "",
});

const enumOptions = (labels: Record<string, string>) =>
  Object.entries(labels).map(([value, label]) => (
    <option key={value} value={value}>
      {label}
    </option>
  ));

export function UnitsManager({
  projectId,
  blocks,
  units,
  landowners,
  canEdit,
}: {
  projectId: string;
  blocks: Block[];
  units: UnitView[];
  landowners: Landowner[];
  canEdit: boolean;
}) {
  const [editing, setEditing] = useState<{ id: string | null; form: UnitForm } | null>(null);
  const [generating, setGenerating] = useState<Record<string, string> | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [ownerTarget, setOwnerTarget] = useState("");
  const { run, error, fieldErrors, pending, reset } = useAction();
  const toggle = (id: string, on: boolean) =>
    setSelected((cur) => {
      const next = new Set(cur);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  const newUnit = (blockId: string): UnitForm => ({
    blockId,
    floor: "1",
    doorNo: "",
    usageType: "RESIDENTIAL",
    layout: "",
    netArea: "",
    grossArea: "",
    commonAreaShare: "",
    facade: "",
    view: "",
    extraArea: "",
    owner: "CONTRACTOR",
    landownerId: "",
    notes: "",
  });
  const setForm = (patch: Partial<UnitForm>) => editing && setEditing({ ...editing, form: { ...editing.form, ...patch } });
  const totalGross = units.reduce((s, u) => s.plus(u.grossArea), new Decimal(0));

  return (
    <div className="grid grid-cols-1 gap-4">
      {!editing && !generating && <FormError message={error} />}
      {canEdit && selected.size > 0 && (
        <div className="sticky top-14 z-20 flex flex-wrap items-center gap-2 rounded-lg border bg-background p-2 shadow-sm md:top-12">
          <span className="px-1 text-sm">{selected.size} bölüm</span>
          <NativeSelect aria-label="Sahip" className="w-56" value={ownerTarget} onChange={(e) => setOwnerTarget(e.target.value)}>
            <option value="">Sahibini değiştir…</option>
            <option value="CONTRACTOR">Müteahhit</option>
            {landowners.map((l) => (
              <option key={l.id} value={l.id}>
                Arsa sahibi: {l.name}
              </option>
            ))}
          </NativeSelect>
          <Button
            size="sm"
            disabled={!ownerTarget || pending}
            onClick={() =>
              run(
                () =>
                  setUnitsOwnerAction(projectId, [...selected], ownerTarget === "CONTRACTOR" ? "CONTRACTOR" : "LANDOWNER", ownerTarget === "CONTRACTOR" ? null : ownerTarget),
                () => {
                  setSelected(new Set());
                  setOwnerTarget("");
                },
              )
            }
          >
            <UserIcon />
            Uygula
          </Button>
          <Button size="sm" variant="ghost" className="text-destructive" disabled={pending} onClick={() => run(() => deleteUnitsAction(projectId, [...selected]), () => setSelected(new Set()))}>
            <Trash2Icon />
            Sil
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
            Seçimi kaldır
          </Button>
        </div>
      )}

      {blocks.map((block) => {
        const rows = units.filter((u) => u.blockId === block.id);
        const gross = rows.reduce((s, u) => s.plus(u.grossArea), new Decimal(0));
        return (
          <Card key={block.id} className="gap-0 pb-0">
            <CardHeader className="pb-4">
              <CardTitle>{block.name}</CardTitle>
              <CardDescription>
                {rows.length} bölüm · brüt {formatNumber(gross)} m²
                {block.constructionArea && ` · blok inşaat alanı ${formatNumber(block.constructionArea)} m²`}
              </CardDescription>
              {canEdit && (
                <CardAction className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => { reset(); setGenerating({ blockId: block.id, fromFloor: "1", toFloor: "4", perFloor: "2", startNo: String(rows.length + 1), usageType: "RESIDENTIAL", layout: "", netArea: "", grossArea: "" }); }}>
                    <LayersIcon />
                    Kat kat üret
                  </Button>
                  <Button size="sm" onClick={() => { reset(); setEditing({ id: null, form: newUnit(block.id) }); }}>
                    <PlusIcon />
                    Bölüm ekle
                  </Button>
                </CardAction>
              )}
            </CardHeader>
            {rows.length > 0 && (
              <Table>
                <TableHeader>
                  <TableRow>
                    {canEdit && <TableHead className="w-8 pl-4" />}
                    <TableHead className={canEdit ? "" : "pl-4"}>Kat</TableHead>
                    <TableHead>No</TableHead>
                    <TableHead>Kullanım / tip</TableHead>
                    <TableHead className="text-right">Net m²</TableHead>
                    <TableHead className="text-right">Brüt m²</TableHead>
                    <TableHead>Sahibi</TableHead>
                    {canEdit && <TableHead className="pr-4" />}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((u) => (
                    <TableRow key={u.id}>
                      {canEdit && (
                        <TableCell className="pl-4">
                          <Checkbox aria-label="Seç" checked={selected.has(u.id)} onCheckedChange={(on) => toggle(u.id, on === true)} />
                        </TableCell>
                      )}
                      <TableCell className={cn("whitespace-nowrap", !canEdit && "pl-4")}>{FLOOR_LABEL(u.floor)}</TableCell>
                      <TableCell className="font-medium">{u.doorNo}</TableCell>
                      <TableCell>
                        {USAGE_TYPE_LABELS[u.usageType]}
                        {u.layout && <span className="text-muted-foreground"> · {u.layout}</span>}
                        {(u.facade || u.view) && <span className="block text-xs text-muted-foreground">{[u.facade, u.view].filter(Boolean).join(" · ")}</span>}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{formatNumber(u.netArea)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatNumber(u.grossArea)}</TableCell>
                      <TableCell className={u.owner === "LANDOWNER" ? "text-amber-800" : ""}>
                        {u.owner === "LANDOWNER" ? (u.landownerName ?? "Arsa sahibi (seçilmemiş)") : UNIT_OWNER_LABELS.CONTRACTOR}
                      </TableCell>
                      {canEdit && (
                        <TableCell className="pr-4 text-right">
                          <Button size="icon" variant="ghost" aria-label="Düzenle" onClick={() => { reset(); setEditing({ id: u.id, form: toForm(u) }); }}>
                            <PencilIcon />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>
        );
      })}
      {units.length > 0 && (
        <p className="text-sm text-muted-foreground">
          Toplam {units.length} bölüm · brüt {formatNumber(totalGross)} m²
        </p>
      )}

      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Bölümü düzenle" : "Bölüm ekle"}</DialogTitle>
          </DialogHeader>
          <FormError message={error} />
          {editing && (
            <div className="grid gap-3 sm:grid-cols-3">
              <FormField id="u-block" label="Blok">
                <NativeSelect id="u-block" value={editing.form.blockId} onChange={(e) => setForm({ blockId: e.target.value })}>
                  {blocks.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </NativeSelect>
              </FormField>
              <FormField id="u-floor" label="Kat" hint="Bodrum −1, zemin 0" error={fieldErrors.floor}>
                <Input id="u-floor" inputMode="numeric" value={editing.form.floor} onChange={(e) => setForm({ floor: e.target.value })} />
              </FormField>
              <FormField id="u-door" label="Kapı no" required error={fieldErrors.doorNo}>
                <Input id="u-door" value={editing.form.doorNo} onChange={(e) => setForm({ doorNo: e.target.value })} />
              </FormField>
              <FormField id="u-usage" label="Kullanım">
                <NativeSelect id="u-usage" value={editing.form.usageType} onChange={(e) => setForm({ usageType: e.target.value as UsageType })}>
                  {enumOptions(USAGE_TYPE_LABELS)}
                </NativeSelect>
              </FormField>
              <FormField id="u-layout" label="Tip">
                <Input id="u-layout" value={editing.form.layout} onChange={(e) => setForm({ layout: e.target.value })} placeholder="2+1, dubleks…" />
              </FormField>
              <FormField id="u-extra" label="Balkon / teras / bahçe m²" error={fieldErrors.extraArea}>
                <Input id="u-extra" inputMode="decimal" value={editing.form.extraArea} onChange={(e) => setForm({ extraArea: e.target.value })} />
              </FormField>
              <FormField id="u-net" label="Net m²" required error={fieldErrors.netArea}>
                <Input id="u-net" inputMode="decimal" value={editing.form.netArea} onChange={(e) => setForm({ netArea: e.target.value })} />
              </FormField>
              <FormField id="u-gross" label="Brüt m²" required error={fieldErrors.grossArea}>
                <Input id="u-gross" inputMode="decimal" value={editing.form.grossArea} onChange={(e) => setForm({ grossArea: e.target.value })} />
              </FormField>
              <FormField id="u-common" label="Ortak alan payı m²" error={fieldErrors.commonAreaShare}>
                <Input id="u-common" inputMode="decimal" value={editing.form.commonAreaShare} onChange={(e) => setForm({ commonAreaShare: e.target.value })} />
              </FormField>
              <FormField id="u-facade" label="Cephe">
                <Input id="u-facade" value={editing.form.facade} onChange={(e) => setForm({ facade: e.target.value })} placeholder="G, K-D…" />
              </FormField>
              <FormField id="u-view" label="Manzara" className="sm:col-span-2">
                <Input id="u-view" value={editing.form.view} onChange={(e) => setForm({ view: e.target.value })} placeholder="Deniz, park…" />
              </FormField>
              <FormField id="u-owner" label="Sahibi">
                <NativeSelect id="u-owner" value={editing.form.owner} onChange={(e) => setForm({ owner: e.target.value as UnitOwner })}>
                  {enumOptions(UNIT_OWNER_LABELS)}
                </NativeSelect>
              </FormField>
              {editing.form.owner === "LANDOWNER" && (
                <FormField id="u-landowner" label="Arsa sahibi" className="sm:col-span-2">
                  <NativeSelect id="u-landowner" value={editing.form.landownerId} onChange={(e) => setForm({ landownerId: e.target.value })}>
                    <option value="">Seçin</option>
                    {landowners.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                  </NativeSelect>
                </FormField>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Vazgeç
            </Button>
            <Button
              disabled={pending}
              onClick={() =>
                editing &&
                run(() => saveUnitAction(projectId, editing.id, { ...editing.form, landownerId: editing.form.landownerId || null }), () => setEditing(null))
              }
            >
              Kaydet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={generating !== null} onOpenChange={(open) => !open && setGenerating(null)}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Kat kat bölüm üret</DialogTitle>
            <DialogDescription>Aynı tipteki bölümleri katlara dağıtır; sonra tek tek düzenlenebilir.</DialogDescription>
          </DialogHeader>
          <FormError message={error} />
          {generating && (
            <div className="grid gap-3 sm:grid-cols-3">
              {(
                [
                  ["fromFloor", "İlk kat"],
                  ["toFloor", "Son kat"],
                  ["perFloor", "Kattaki bölüm"],
                  ["startNo", "İlk kapı no"],
                  ["netArea", "Net m²"],
                  ["grossArea", "Brüt m²"],
                ] as const
              ).map(([key, label]) => (
                <FormField key={key} id={`g-${key}`} label={label} error={fieldErrors[key]}>
                  <Input id={`g-${key}`} inputMode="decimal" value={generating[key]} onChange={(e) => setGenerating({ ...generating, [key]: e.target.value })} />
                </FormField>
              ))}
              <FormField id="g-usage" label="Kullanım">
                <NativeSelect id="g-usage" value={generating.usageType} onChange={(e) => setGenerating({ ...generating, usageType: e.target.value })}>
                  {enumOptions(USAGE_TYPE_LABELS)}
                </NativeSelect>
              </FormField>
              <FormField id="g-layout" label="Tip">
                <Input id="g-layout" value={generating.layout} onChange={(e) => setGenerating({ ...generating, layout: e.target.value })} placeholder="2+1" />
              </FormField>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setGenerating(null)}>
              Vazgeç
            </Button>
            <Button disabled={pending} onClick={() => generating && run(() => generateUnitsAction(projectId, generating), () => setGenerating(null))}>
              Üret
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
