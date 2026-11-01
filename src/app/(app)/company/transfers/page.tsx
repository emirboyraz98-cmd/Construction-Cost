import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { NoAccess } from "@/components/purchasing/shared";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { dateToDateInput, formatDateOnly, formatMoney, formatNumber } from "@/lib/format";
import { listTransfers, transferOptions } from "@/server/transfers";
import { DeleteTransferButton, TransferForm } from "./transfer-form";

export const metadata: Metadata = { title: "Malzeme transferi" };

export default async function TransfersPage() {
  const [options, rows] = await Promise.all([transferOptions(), listTransfers()]);
  if (options.projects.length < 2 && rows.length === 0) {
    return <NoAccess text="Transfer için en az iki projede transfer yetkiniz (yönetici, muhasebe, satın alma) olmalı." />;
  }
  return (
    <>
      <PageHeader
        title="Projeler arası malzeme transferi"
        description="Bir şantiyede artan malzemeyi başka projeye gönderin; maliyeti de o projeye taşınır."
      />
      <div className="grid max-w-5xl grid-cols-1 gap-4">
        {options.projects.length >= 2 && <TransferForm options={options} today={dateToDateInput(new Date())} />}
        <Card>
          <CardHeader>
            <CardTitle>Son transferler</CardTitle>
          </CardHeader>
          <CardContent>
            {rows.length === 0 ? (
              <p className="text-sm text-muted-foreground">Henüz transfer yok.</p>
            ) : (
              <ul className="grid grid-cols-1 gap-2 text-sm">
                {rows.map((t) => (
                  <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-2.5">
                    <span className="min-w-0">
                      <span className="font-medium">
                        {formatDateOnly(t.date)} · {t.fromProject.name} → {t.toProject.name}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {t.description} · {t.costItemCode}
                        {t.quantity && ` · ${formatNumber(t.quantity, 4)} ${t.unit ?? ""}`} · {t.createdBy.name}
                      </span>
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="tabular-nums">{formatMoney(t.amount)}</span>
                      {t.canDelete && <DeleteTransferButton transferId={t.id} />}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
