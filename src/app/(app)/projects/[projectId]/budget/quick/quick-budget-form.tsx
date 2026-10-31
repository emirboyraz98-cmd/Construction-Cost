"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Decimal from "decimal.js";
import { SaveIcon } from "lucide-react";
import { FormError } from "@/components/form-field";
import { InfoTip } from "@/components/info-tip";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { useAction } from "@/components/use-action";
import { formatMoney, formatNumber, parseDecimalInput } from "@/lib/format";
import { saveQuickBudgetAction } from "./actions";

type Group = { id: string; code: string; name: string; mode: "m2" | "lump"; amount: string; detailed: number };

/** Ana gruplara m² başına veya götürü tutar; canlı toplam ve m² maliyeti. */
export function QuickBudgetForm({ projectId, area, groups }: { projectId: string; area: string; groups: Group[] }) {
  const router = useRouter();
  const { run, error, pending } = useAction();
  const areaDec = new Decimal(area || 0);
  const [rows, setRows] = useState(() => groups.map((g) => ({ ...g, amount: g.amount ? formatNumber(g.amount, 2) : "" })));
  const parsed = rows.map((r) => {
    const p = parseDecimalInput(r.amount);
    const amount = p.ok ? (p.value ?? new Decimal(0)) : null;
    const total = amount == null ? null : r.mode === "m2" ? amount.times(areaDec) : amount;
    return { ...r, value: amount, total };
  });
  const invalid = parsed.some((r) => r.value == null || r.value.isNegative());
  const grand = parsed.reduce((sum, r) => sum.plus(r.total ?? 0), new Decimal(0));
  const set = (i: number, patch: Partial<Group>) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  return (
    <div className="grid gap-4">
      <Card className="py-4">
        <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <div>
            <p className="flex items-center gap-1 text-xs text-muted-foreground">
              İnşaat alanı <InfoTip term="İnşaat alanı" />
            </p>
            <p className="font-medium tabular-nums">{areaDec.gt(0) ? `${formatNumber(areaDec)} m²` : "Blok alanı girilmemiş"}</p>
          </div>
          <div>
            <p className="flex items-center gap-1 text-xs text-muted-foreground">
              Toplam maliyet (KDV hariç) <InfoTip term="Toplam maliyet" />
            </p>
            <p className="font-medium tabular-nums">{formatMoney(grand)}</p>
          </div>
          <div>
            <p className="flex items-center gap-1 text-xs text-muted-foreground">
              Toplam / inşaat m² <InfoTip term="Toplam / inşaat m²" />
            </p>
            <p className="font-medium tabular-nums">{areaDec.gt(0) ? formatMoney(grand.div(areaDec)) : "—"}</p>
          </div>
        </CardContent>
      </Card>

      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Ana grup</th>
              <th className="px-3 py-2 font-medium">Hesap</th>
              <th className="px-3 py-2 text-right font-medium">Tutar (TL, KDV hariç)</th>
              <th className="px-3 py-2 text-right font-medium">Grup toplamı</th>
            </tr>
          </thead>
          <tbody>
            {parsed.map((r, i) => (
              <tr key={r.id} className="border-t align-top">
                <td className="px-3 py-2">
                  <span className="font-medium">
                    {r.code} {r.name}
                  </span>
                  {r.detailed > 0 && <span className="block text-xs text-amber-700">Bu grupta {r.detailed} ayrıntılı satır var; tutarı iki kez yazmayın.</span>}
                </td>
                <td className="px-3 py-2">
                  <NativeSelect aria-label={`${r.code} hesap şekli`} value={r.mode} onChange={(e) => set(i, { mode: e.target.value as Group["mode"] })} className="w-36">
                    <option value="m2">m² başına</option>
                    <option value="lump">Götürü (toplam)</option>
                  </NativeSelect>
                </td>
                <td className="px-3 py-2">
                  <Input
                    aria-label={`${r.code} ${r.name} tutar`}
                    inputMode="decimal"
                    value={r.amount}
                    onChange={(e) => set(i, { amount: e.target.value })}
                    placeholder={r.mode === "m2" ? "m² başına TL" : "toplam TL"}
                    className="ml-auto w-40 text-right tabular-nums"
                    aria-invalid={r.value == null || undefined}
                  />
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{r.total && r.total.gt(0) ? formatMoney(r.total) : "—"}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t bg-muted/30 font-medium">
              <td className="px-3 py-2" colSpan={3}>
                Toplam
              </td>
              <td className="px-3 py-2 text-right tabular-nums">{formatMoney(grand)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <FormError message={error ?? (invalid ? "Tutarları sayı olarak yazın (ör. 4.500 veya 4500,50)." : undefined)} />
      <div className="flex flex-wrap items-center gap-3">
        <Button
          disabled={pending || invalid}
          onClick={() =>
            run(
              () => saveQuickBudgetAction(projectId, parsed.map((r) => ({ costItemId: r.id, mode: r.mode, amount: (r.value ?? new Decimal(0)).toString() }))),
              () => router.push(`/projects/${projectId}/budget`),
            )
          }
        >
          <SaveIcon />
          Bütçeye kaydet
        </Button>
        <p className="text-xs text-muted-foreground">Tekrar kaydedince önceki hızlı bütçe satırlarının yerine geçer; ayrıntılı satırlara dokunulmaz.</p>
      </div>
    </div>
  );
}
