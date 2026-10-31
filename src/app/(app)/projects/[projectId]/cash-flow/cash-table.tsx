import { Card } from "@/components/ui/card";
import type { CashRow } from "@/lib/cashflow/cashflow";
import { monthLabel } from "@/lib/cashflow/cashflow";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";

const m = (v: { isZero(): boolean; toString(): string }) => (v.isZero() ? "—" : formatMoney(v.toString()));

/** Aylık nakit tablosu (grafiğin tablo görünümü). */
export function CashTable({ rows, showOverhead = false }: { rows: CashRow[]; showOverhead?: boolean }) {
  return (
    <Card className="gap-0 overflow-x-auto py-0">
      <table className="w-full min-w-[1100px] text-sm">
        <thead className="border-b text-left text-xs text-muted-foreground">
          <tr>
            <th className="px-4 py-2 font-medium">Ay</th>
            <th className="px-2 py-2 text-right font-medium">Harcama</th>
            <th className="px-2 py-2 text-right font-medium">Hakediş</th>
            <th className="px-2 py-2 text-right font-medium">Bağlantı</th>
            {showOverhead && <th className="px-2 py-2 text-right font-medium">Genel merkez</th>}
            <th className="px-2 py-2 text-right font-medium">Planlanan maliyet</th>
            <th className="px-2 py-2 text-right font-medium">Finansman</th>
            <th className="px-2 py-2 text-right font-medium">Toplam çıkış</th>
            <th className="px-2 py-2 text-right font-medium">Tahsil edilen</th>
            <th className="px-2 py-2 text-right font-medium">Beklenen taksit / çek</th>
            <th className="px-2 py-2 text-right font-medium">Satış varsayımı</th>
            <th className="px-2 py-2 text-right font-medium">Toplam giriş</th>
            <th className="px-2 py-2 text-right font-medium">Net</th>
            <th className="px-4 py-2 text-right font-medium">Kümülatif</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.month} className={cn("border-b", r.past && "text-muted-foreground")}>
              <td className="px-4 py-1.5 whitespace-nowrap">{monthLabel(r.month)}</td>
              <td className="px-2 py-1.5 text-right tabular-nums">{m(r.outExpense)}</td>
              <td className="px-2 py-1.5 text-right tabular-nums">{m(r.outProgress)}</td>
              <td className="px-2 py-1.5 text-right tabular-nums">{m(r.outConnection)}</td>
              {showOverhead && <td className="px-2 py-1.5 text-right tabular-nums">{m(r.outOverhead)}</td>}
              <td className="px-2 py-1.5 text-right tabular-nums">{m(r.outPlanned)}</td>
              <td className="px-2 py-1.5 text-right tabular-nums">{m(r.outFinancing)}</td>
              <td className="px-2 py-1.5 text-right font-medium tabular-nums">{m(r.outTotal)}</td>
              <td className="px-2 py-1.5 text-right tabular-nums">{m(r.inCollected)}</td>
              <td className="px-2 py-1.5 text-right tabular-nums">{m(r.inScheduled)}</td>
              <td className="px-2 py-1.5 text-right tabular-nums">{m(r.inSales)}</td>
              <td className="px-2 py-1.5 text-right font-medium tabular-nums">{m(r.inTotal)}</td>
              <td className={cn("px-2 py-1.5 text-right tabular-nums", r.net.isNegative() && "text-destructive")}>{m(r.net)}</td>
              <td className={cn("px-4 py-1.5 text-right font-medium tabular-nums", r.balance.isNegative() && "text-destructive")}>{formatMoney(r.balance.toString())}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
