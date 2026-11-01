import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PencilIcon } from "lucide-react";
import { CashChart } from "@/components/cash-chart";
import { MoreFigures } from "@/components/more-figures";
import { PageHeader } from "@/components/page-header";
import { Figure } from "@/components/purchasing/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { monthLabel } from "@/lib/cashflow/cashflow";
import { dateToDateInput, formatDateOnly, formatMoney, formatNumber } from "@/lib/format";
import { MACHINE_ENTRY_TYPE_LABELS, MACHINE_STATUS_LABELS, MACHINE_UNIT_LABELS } from "@/lib/machines/labels";
import { isIncome } from "@/lib/machines/machines";
import { cn } from "@/lib/utils";
import { getMachine } from "@/server/machines";
import { EntryActions, EntryDialog, UsageDelete, UsageDialog } from "./machine-panels";

export const metadata: Metadata = { title: "Makine" };

const monthKey = (m: number) => String(m);
const m0 = (v: { isZero(): boolean; toString(): string }) => (v.isZero() ? "—" : formatMoney(v.toString()));

export default async function MachinePage({ params }: PageProps<"/company/machines/[machineId]">) {
  const { machineId } = await params;
  const data = await getMachine(machineId);
  if (!data) notFound();
  const { machine: m, flow, canManage } = data;
  const t = flow.totals;
  const unit = MACHINE_UNIT_LABELS[m.usageUnit];
  const today = dateToDateInput(new Date());

  return (
    <>
      <PageHeader
        title={`${m.code} · ${m.name}`}
        description={[m.category, [m.brand, m.model].filter(Boolean).join(" "), m.plateOrSerial, m.year].filter(Boolean).join(" · ") || undefined}
        actions={
          canManage && (
            <Button asChild variant="outline">
              <Link href={`/company/machines/${m.id}/edit`}>
                <PencilIcon />
                Düzenle
              </Link>
            </Button>
          )
        }
      >
        <div className="mt-2 flex flex-wrap gap-2">
          <Badge variant={m.status === "ACTIVE" ? "default" : "secondary"}>{MACHINE_STATUS_LABELS[m.status]}</Badge>
          {m.internalRate && (
            <Badge variant="outline">
              İç kullanım {formatMoney(m.internalRate)} / {unit}
            </Badge>
          )}
        </div>
      </PageHeader>

      <div className="grid grid-cols-1 gap-4">
        <Card className="py-4">
          <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Figure label="Kümülatif net nakit" value={formatMoney(t.net)} tone={t.net.isNegative() ? "warn" : undefined} note="Giren − çıkan nakit (planlılar dahil)" />
            <Figure label="İç kullanım dahil" value={formatMoney(t.netWithUsage)} tone={t.netWithUsage.isNegative() ? "warn" : undefined} note={flow.paybackMonth ? `Geri dönüş: ${monthLabel(flow.paybackMonth)}` : "Henüz geri dönmedi"} />
            <Figure label="Toplam çalışma" value={`${formatNumber(t.usageQty)} ${unit}`} note={`İç kullanım değeri ${formatMoney(t.usageValue)}`} />
            <Figure label="Saat başı işletme maliyeti" value={t.operatingCostPerUnit ? `${formatMoney(t.operatingCostPerUnit)} / ${unit}` : "—"} note="Satın alma ve kredi hariç giderler ÷ çalışma" />
            <MoreFigures>
              <Figure label="Nakit girişi" value={formatMoney(t.cashIn)} note="Kira geliri, satış" />
              <Figure label="Nakit çıkışı" value={formatMoney(t.cashOut)} note="Alım, taksit, yakıt, bakım …" />
              <Figure label="Planlı çıkış" value={formatMoney(t.plannedOut)} note="Ödenmemiş hareketler (vadesinde)" />
              <Figure label="İşletme maliyeti" value={formatMoney(t.operatingCost)} />
            </MoreFigures>
          </CardContent>
        </Card>

        {flow.rows.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle info="Kümülatif nakit akışı">Kümülatif nakit akışı</CardTitle>
              <CardDescription>Aylık nakit girişi / çıkışı ve biriken bakiye. Kesikli çizgi, makinenin kendi projelerinizdeki çalışmasının değerini de ekler.</CardDescription>
            </CardHeader>
            <CardContent>
              <CashChart
                currentKey={monthKey(data.currentMonth)}
                labels={{ inflow: "Nakit girişi (kira, satış)", outflow: "Nakit çıkışı (alım, taksit, yakıt, bakım …)", balance: "Kümülatif nakit", balance2: "İç kullanım dahil" }}
                rows={flow.rows.map((r) => ({ key: monthKey(r.month), label: monthLabel(r.month), inflow: Number(r.cashIn), outflow: Number(r.cashOut), balance: Number(r.cumulative), balance2: Number(r.cumulativeWithUsage), past: r.past }))}
              />
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Nakit hareketleri</CardTitle>
            <CardDescription>Satın alma, taksit, yakıt, bakım, onarım, kira geliri … (TL, KDV dahil)</CardDescription>
            {canManage && (
              <CardAction>
                <EntryDialog machineId={m.id} projects={data.projects} today={today} />
              </CardAction>
            )}
          </CardHeader>
          <CardContent>
            {m.entries.length === 0 ? (
              <p className="text-sm text-muted-foreground">Henüz hareket yok. Satın alma bedelini ve giderleri “Hareket ekle” ile girin.</p>
            ) : (
              <ul className="grid grid-cols-1 gap-2 text-sm">
                {m.entries.map((e) => (
                  <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-2.5">
                    <span className="min-w-0">
                      <span className="font-medium">
                        {formatDateOnly(e.date)} · {MACHINE_ENTRY_TYPE_LABELS[e.type]}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {[e.description, e.quantity ? `${formatNumber(e.quantity)} ${e.unit ?? ""}` : null, e.project?.name, e.counterparty].filter(Boolean).join(" · ") || "—"}
                      </span>
                    </span>
                    <span className="ml-auto flex min-w-0 flex-wrap items-center justify-end gap-2">
                      {!e.paid && <Badge variant="outline">Vade {e.dueDate ? formatDateOnly(e.dueDate) : "—"}</Badge>}
                      <span className={cn("tabular-nums font-medium", isIncome(e.type) ? "text-emerald-700" : "")}>
                        {isIncome(e.type) ? "+" : "−"}
                        {formatMoney(e.amount)}
                      </span>
                      {canManage && <EntryActions entryId={e.id} paid={e.paid} />}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle info="Puantaj">Puantaj (projelerde çalışma)</CardTitle>
            <CardDescription>Her kayıt projeye “Makine çalışması” maliyeti olarak yazılır.</CardDescription>
            {canManage && (
              <CardAction>
                <UsageDialog
                  machineId={m.id}
                  unitLabel={unit}
                  defaultRate={m.internalRate ? formatNumber(m.internalRate, 2) : ""}
                  projects={data.projects}
                  costItems={data.costItems}
                  today={today}
                />
              </CardAction>
            )}
          </CardHeader>
          <CardContent>
            {m.usages.length === 0 ? (
              <p className="text-sm text-muted-foreground">Henüz puantaj yok.</p>
            ) : (
              <ul className="grid grid-cols-1 gap-2 text-sm">
                {m.usages.map((u) => (
                  <li key={u.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-2.5">
                    <span className="min-w-0">
                      <span className="font-medium">
                        {formatDateOnly(u.date)} · {data.usageProjectVisible[u.id] ? u.project.name : "Yetkiniz olmayan proje"}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {u.costItem.code} {u.costItem.name} · {formatNumber(u.quantity)} {unit} × {formatMoney(u.rate)}
                        {u.description ? ` · ${u.description}` : ""}
                      </span>
                    </span>
                    <span className="ml-auto flex min-w-0 flex-wrap items-center justify-end gap-2">
                      <span className="font-medium tabular-nums">{formatMoney(u.amount)}</span>
                      {canManage && data.usageProjectVisible[u.id] && <UsageDelete usageId={u.id} />}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {flow.rows.length > 0 && (
          <Card className="gap-0 overflow-x-auto py-0">
            <table className="w-full min-w-[860px] text-sm">
              <thead className="border-b text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 font-medium">Ay</th>
                  <th className="px-2 py-2 text-right font-medium">Giriş</th>
                  <th className="px-2 py-2 text-right font-medium">Çıkış</th>
                  <th className="px-2 py-2 text-right font-medium">Net</th>
                  <th className="px-2 py-2 text-right font-medium">Kümülatif nakit</th>
                  <th className="px-2 py-2 text-right font-medium">Çalışma</th>
                  <th className="px-2 py-2 text-right font-medium">İç kullanım değeri</th>
                  <th className="px-4 py-2 text-right font-medium">Kümülatif (iç kullanım dahil)</th>
                </tr>
              </thead>
              <tbody>
                {flow.rows.map((r) => (
                  <tr key={r.month} className={cn("border-b", r.past && "text-muted-foreground")}>
                    <td className="px-4 py-1.5 whitespace-nowrap">{monthLabel(r.month)}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{m0(r.cashIn)}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{m0(r.cashOut)}</td>
                    <td className={cn("px-2 py-1.5 text-right tabular-nums", r.net.isNegative() && "text-destructive")}>{m0(r.net)}</td>
                    <td className={cn("px-2 py-1.5 text-right font-medium tabular-nums", r.cumulative.isNegative() && "text-destructive")}>{formatMoney(r.cumulative)}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{r.usageQty.isZero() ? "—" : `${formatNumber(r.usageQty)} ${unit}`}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{m0(r.usageValue)}</td>
                    <td className={cn("px-4 py-1.5 text-right font-medium tabular-nums", r.cumulativeWithUsage.isNegative() && "text-destructive")}>{formatMoney(r.cumulativeWithUsage)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </div>
    </>
  );
}
