"use client";

import { useState } from "react";
import { PencilIcon, WandSparklesIcon } from "lucide-react";
import { FormError, FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useAction } from "@/components/use-action";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import { applyDefaultScheduleAction, saveScheduleAction } from "../actions";

export type ScheduleRowView = { id: string; code: string; name: string; depth: number; budget: string; startMonth: number; endMonth: number; source: "own" | "parent" | "project" };

/** Basit Gantt: kalem başına başlangıç–bitiş ayı (PLAN 7.8). */
export function ScheduleGantt({ projectId, rows, duration, monthLabels, currentIndex, canEdit }: { projectId: string; rows: ScheduleRowView[]; duration: number; monthLabels: string[]; currentIndex: number | null; canEdit: boolean }) {
  const [editing, setEditing] = useState<ScheduleRowView | null>(null);
  const [range, setRange] = useState({ startMonth: "", endMonth: "" });
  const { run, error, fieldErrors, pending } = useAction();
  const months = Array.from({ length: duration }, (_, i) => i + 1);
  return (
    <div className="grid grid-cols-1 gap-3">
      {canEdit && (
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" disabled={pending} onClick={() => run(() => applyDefaultScheduleAction(projectId))}>
            <WandSparklesIcon />
            Varsayılan program öner
          </Button>
          <span className="text-xs text-muted-foreground">Programı olmayan ana gruplara tipik konut projesi sırasına göre süreye oranlı aralık yazılır; projeye göre düzeltin.</span>
        </div>
      )}
      {!editing && <FormError message={error} />}
      <Card className="gap-0 overflow-x-auto py-0">
        <table className="text-sm" style={{ minWidth: 360 + duration * 28 }}>
          <thead className="border-b text-xs text-muted-foreground">
            <tr>
              <th className="sticky left-0 z-10 w-72 bg-card px-4 py-2 text-left font-medium">Kalem</th>
              <th className="px-2 py-2 text-right font-medium">Bütçe</th>
              {months.map((m) => (
                <th key={m} className={cn("w-7 px-0 py-2 text-center font-normal", currentIndex === m && "text-foreground")} title={monthLabels[m - 1]}>
                  {m}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className={cn("border-b", r.depth === 0 && "bg-muted/30")}>
                <td className="sticky left-0 z-10 bg-card px-4 py-1.5" style={{ paddingLeft: `${1 + r.depth * 1.25}rem` }}>
                  <span className="flex items-center justify-between gap-2">
                    <span className={cn("min-w-0 truncate", r.depth === 0 && "font-medium")}>
                      {r.code} {r.name}
                    </span>
                    {canEdit && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-6 shrink-0"
                        aria-label={`${r.code} programı`}
                        onClick={() => {
                          setEditing(r);
                          setRange({ startMonth: String(r.startMonth), endMonth: String(r.endMonth) });
                        }}
                      >
                        <PencilIcon className="size-3.5" />
                      </Button>
                    )}
                  </span>
                  <span className="block text-[11px] text-muted-foreground">
                    {r.startMonth}.–{r.endMonth}. ay · {r.source === "own" ? "kendi programı" : r.source === "parent" ? "üst kalemden" : "tüm proje süresi"}
                  </span>
                </td>
                <td className="px-2 py-1.5 text-right text-xs whitespace-nowrap tabular-nums">{Number(r.budget) ? formatMoney(r.budget) : "—"}</td>
                {months.map((m) => {
                  const on = m >= r.startMonth && m <= r.endMonth;
                  return (
                    <td key={m} className={cn("h-8 px-0", currentIndex === m && "bg-amber-50")}>
                      {on && (
                        <span
                          className={cn("mx-auto block h-3", r.source === "own" ? "bg-[#2a78d6]" : "bg-[#2a78d6]/35", m === r.startMonth && "rounded-l", m === r.endMonth && "rounded-r")}
                          aria-hidden
                        />
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              İş programı – {editing?.code} {editing?.name}
            </DialogTitle>
            <DialogDescription>Proje ayı olarak (1 = başlangıç ayı, proje süresi {duration} ay). Kaldırılırsa üst kalemin veya tüm projenin aralığı kullanılır.</DialogDescription>
          </DialogHeader>
          <FormError message={error} />
          <div className="grid grid-cols-2 gap-3">
            <FormField id="sc-start" label="Başlangıç ayı" error={fieldErrors.startMonth}>
              <Input id="sc-start" inputMode="numeric" value={range.startMonth} onChange={(e) => setRange((r) => ({ ...r, startMonth: e.target.value }))} />
            </FormField>
            <FormField id="sc-end" label="Bitiş ayı" error={fieldErrors.endMonth}>
              <Input id="sc-end" inputMode="numeric" value={range.endMonth} onChange={(e) => setRange((r) => ({ ...r, endMonth: e.target.value }))} />
            </FormField>
          </div>
          <DialogFooter>
            {editing?.source === "own" && (
              <Button variant="ghost" className="text-destructive" disabled={pending} onClick={() => editing && run(() => saveScheduleAction(projectId, editing.id, null), () => setEditing(null))}>
                Programı kaldır
              </Button>
            )}
            <Button variant="outline" onClick={() => setEditing(null)}>
              Vazgeç
            </Button>
            <Button disabled={pending} onClick={() => editing && run(() => saveScheduleAction(projectId, editing.id, range), () => setEditing(null))}>
              Kaydet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
