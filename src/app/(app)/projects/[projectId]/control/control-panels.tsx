"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { LockIcon, PencilIcon, Trash2Icon } from "lucide-react";
import { FormError, FormField } from "@/components/form-field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { useAction } from "@/components/use-action";
import { formatMoney, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { createBaselineAction, deleteBaselineAction, setProgressAction } from "./actions";

type Status = "over" | "risk" | "ok" | "unbudgeted";

export type ControlRowView = {
  id: string;
  code: string;
  name: string;
  depth: number;
  isLeaf: boolean;
  unit: string | null;
  baseline: string | null;
  budget: string;
  budgetQuantity: string | null;
  actual: string;
  actualQuantity: string | null;
  percent: string | null;
  percentSource: "manual" | "quantity" | null;
  manualPercent: string | null;
  progressNote: string | null;
  eac: string;
  variance: string;
  status: Status;
};

const STATUS: Record<Status, { label: string; className: string }> = {
  over: { label: "Aşıldı", className: "border-red-300 bg-red-50 text-red-700" },
  risk: { label: "Aşım bekleniyor", className: "border-amber-300 bg-amber-50 text-amber-800" },
  unbudgeted: { label: "Bütçesiz", className: "border-violet-300 bg-violet-50 text-violet-800" },
  ok: { label: "", className: "" },
};

export function StatusBadge({ status }: { status: Status }) {
  if (status === "ok") return null;
  return (
    <Badge variant="outline" className={STATUS[status].className}>
      {STATUS[status].label}
    </Badge>
  );
}

export function BaselineControls({
  projectId,
  baselines,
  selectedId,
  canEdit,
  today,
}: {
  projectId: string;
  baselines: { id: string; name: string; createdAt: string; total: string }[];
  selectedId: string | null;
  canEdit: boolean;
  today: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(`Onaylı bütçe – ${today}`);
  const [note, setNote] = useState("");
  const { run, error, fieldErrors, pending } = useAction();
  return (
    <div className="flex flex-wrap items-center gap-2">
      <NativeSelect
        aria-label="Karşılaştırılan baz bütçe"
        className="w-72"
        value={selectedId ?? ""}
        onChange={(e) => router.push(e.target.value ? `?baz=${e.target.value}` : "?")}
        disabled={baselines.length === 0}
      >
        {baselines.length === 0 && <option value="">Baz bütçe yok — güncel bütçeyle karşılaştırılıyor</option>}
        {baselines.map((b) => (
          <option key={b.id} value={b.id}>
            {b.name} · {formatMoney(b.total)}
          </option>
        ))}
      </NativeSelect>
      {canEdit && (
        <>
          <Button variant="outline" onClick={() => setOpen(true)}>
            <LockIcon />
            Bütçeyi dondur (baz bütçe)
          </Button>
          {selectedId && (
            <Button variant="ghost" className="text-destructive" disabled={pending} onClick={() => run(() => deleteBaselineAction(projectId, selectedId), () => router.push("?"))}>
              <Trash2Icon />
              Bu baz bütçeyi sil
            </Button>
          )}
        </>
      )}
      {!open && <FormError message={error} />}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Baz bütçe oluştur</DialogTitle>
            <DialogDescription>
              Güncel bütçe bugünkü fiyat ve miktarlarla dondurulur. Sapma bu referansa göre izlenir; güncel bütçe ise fiyat ve metraj değiştikçe değişmeye devam eder.
            </DialogDescription>
          </DialogHeader>
          <FormError message={error} />
          <FormField id="bl-name" label="Ad" required error={fieldErrors.name}>
            <Input id="bl-name" value={name} onChange={(e) => setName(e.target.value)} />
          </FormField>
          <FormField id="bl-note" label="Not">
            <Input id="bl-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="ör. Yönetim kurulu onayı" />
          </FormField>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Vazgeç
            </Button>
            <Button
              disabled={pending}
              onClick={() =>
                run(
                  () => createBaselineAction(projectId, { name, note }),
                  (r) => {
                    setOpen(false);
                    router.push(`?baz=${r.id}`);
                  },
                )
              }
            >
              Dondur
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function ControlTable({ projectId, rows, hasBaseline, canEdit }: { projectId: string; rows: ControlRowView[]; hasBaseline: boolean; canEdit: boolean }) {
  const [onlyIssues, setOnlyIssues] = useState(false);
  const [editing, setEditing] = useState<ControlRowView | null>(null);
  const [percent, setPercent] = useState("");
  const [note, setNote] = useState("");
  const { run, error, fieldErrors, pending } = useAction();
  const visible = onlyIssues ? rows.filter((r) => r.status !== "ok") : rows;
  const money = (v: string | null) => (v == null ? "—" : Number(v) === 0 ? "—" : formatMoney(v));

  return (
    <div className="grid grid-cols-1 gap-3">
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" className="size-4" checked={onlyIssues} onChange={(e) => setOnlyIssues(e.target.checked)} />
        Yalnızca aşım, risk ve bütçesiz kalemler
      </label>
      <Card className="gap-0 overflow-x-auto py-0">
        <table className="w-full min-w-[860px] text-sm">
          <thead className="border-b text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-2 font-medium">Kalem</th>
              {hasBaseline && <th className="px-2 py-2 text-right font-medium">Baz bütçe</th>}
              <th className="px-2 py-2 text-right font-medium">Güncel bütçe</th>
              <th className="px-2 py-2 text-right font-medium">Gerçekleşen</th>
              <th className="px-2 py-2 text-right font-medium">Tamamlanma</th>
              <th className="px-2 py-2 text-right font-medium">Tahmini toplam</th>
              <th className="px-4 py-2 text-right font-medium">Sapma</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => (
              <tr key={r.id} className={cn("border-b", r.depth === 0 && "bg-muted/40 font-semibold")}>
                <td className="px-4 py-2" style={{ paddingLeft: `${1 + r.depth * 1.25}rem` }}>
                  <span className="flex flex-wrap items-center gap-1.5">
                    {r.code} {r.name}
                    <StatusBadge status={r.status} />
                  </span>
                  {r.isLeaf && r.budgetQuantity && (
                    <span className="block text-xs font-normal text-muted-foreground">
                      {formatNumber(r.actualQuantity ?? 0, 2)} / {formatNumber(r.budgetQuantity, 2)} {r.unit}
                    </span>
                  )}
                </td>
                {hasBaseline && <td className="px-2 py-2 text-right tabular-nums">{money(r.baseline)}</td>}
                <td className="px-2 py-2 text-right tabular-nums">{money(r.budget)}</td>
                <td className="px-2 py-2 text-right tabular-nums">{money(r.actual)}</td>
                <td className="px-2 py-2 text-right whitespace-nowrap tabular-nums">
                  {r.percent ? `%${formatNumber(r.percent, 1)}` : "—"}
                  {r.percentSource && <span className="block text-[11px] font-normal text-muted-foreground">{r.percentSource === "manual" ? "elle" : "miktardan"}</span>}
                  {canEdit && r.isLeaf && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-6"
                      aria-label={`${r.code} tamamlanma`}
                      onClick={() => {
                        setEditing(r);
                        setPercent(r.manualPercent ? formatNumber(r.manualPercent, 2) : "");
                        setNote(r.progressNote ?? "");
                      }}
                    >
                      <PencilIcon className="size-3.5" />
                    </Button>
                  )}
                </td>
                <td className="px-2 py-2 text-right tabular-nums">{money(r.eac)}</td>
                <td className={cn("px-4 py-2 text-right tabular-nums", Number(r.variance) < 0 && "text-destructive")}>
                  {Number(r.variance) === 0 ? "—" : formatMoney(r.variance)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tamamlanma yüzdesi</DialogTitle>
            <DialogDescription>
              {editing?.code} {editing?.name}. Boş bırakılırsa miktardan hesaplanır (bütçe ve harcama birimi aynıysa). Tahmini toplam = gerçekleşen + güncel bütçe × (1 − tamamlanma).
            </DialogDescription>
          </DialogHeader>
          <FormError message={error} />
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField id="pr-percent" label="Tamamlanma (%)" error={fieldErrors.percent}>
              <Input id="pr-percent" inputMode="decimal" value={percent} onChange={(e) => setPercent(e.target.value)} placeholder="ör. 35" />
            </FormField>
            <FormField id="pr-note" label="Not">
              <Input id="pr-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="ör. 3. kat döşemesi bitti" />
            </FormField>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Vazgeç
            </Button>
            <Button disabled={pending} onClick={() => editing && run(() => setProgressAction(projectId, editing.id, { percent, note }), () => setEditing(null))}>
              Kaydet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
