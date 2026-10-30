import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PencilIcon } from "lucide-react";
import { ApprovalBadge } from "@/components/expenses/badges";
import { InfoList } from "@/components/info-list";
import { PageHeader } from "@/components/page-header";
import { AlertList, ConnectionStatusBadge, DocumentGallery, Figure, Meter, NoAccess } from "@/components/purchasing/shared";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { hasCapability } from "@/lib/auth/roles";
import { PRICE_TYPE_LABELS } from "@/lib/connections/labels";
import { CURRENCY_LABELS } from "@/lib/expenses/labels";
import { dueBucket } from "@/lib/expenses/payables";
import { dateToDateInput, Decimal, formatDateOnly, formatDateTime, formatMoney, formatNumber } from "@/lib/format";
import { getAccess } from "@/server/access";
import { getConnection, linkableAdvances } from "@/server/connections";
import { connectionGains } from "@/server/control";
import { listProjectSummaries } from "@/server/projects";
import { AdvancesPanel, AllocationButton, ConnectionActions, InvoicesPanel, PaymentsPanel } from "./connection-panels";

export const metadata: Metadata = { title: "Bağlantı" };

export default async function ConnectionPage({ params }: PageProps<"/company/connections/[connectionId]">) {
  const { connectionId } = await params;
  const { user } = await getAccess();
  if (!hasCapability(user.role, "connection.view")) return <NoAccess text="Malzeme bağlantılarını görme yetkiniz yok." />;
  const detail = await getConnection(connectionId);
  if (!detail) notFound();
  const { connection: c, draws, advances, history, projectName, canManage } = detail;
  const [projects, linkable] = canManage ? await Promise.all([listProjectSummaries(), linkableAdvances(c.id)]) : [[], []];
  const gains = await connectionGains(c.id);
  const totalGain = gains.reduce((sum, g) => (g.gain ? sum.plus(g.gain) : sum), new Decimal(0));
  const today = new Date();
  const cur = c.currency;
  const itemName = new Map(c.items.map((i) => [i.id, i]));

  return (
    <>
      <PageHeader
        title={`${c.no} · ${c.supplier.name}`}
        description={`${PRICE_TYPE_LABELS[c.priceType]} · ${CURRENCY_LABELS[cur]} · ${formatDateOnly(c.date)}`}
        actions={
          canManage && (
            <Button asChild variant="outline">
              <Link href={`/company/connections/${c.id}/edit`}>
                <PencilIcon />
                Düzenle
              </Link>
            </Button>
          )
        }
      >
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <ConnectionStatusBadge status={c.status} />
          {canManage && <ConnectionActions connectionId={c.id} status={c.status} />}
        </div>
      </PageHeader>

      <div className="grid grid-cols-1 gap-4">
        {c.alerts.length > 0 && (
          <Card className="border-amber-300 py-4">
            <CardContent>
              <AlertList alerts={c.alerts} />
            </CardContent>
          </Card>
        )}

        <Card className="py-4">
          <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            <Figure label="Bağlantı tutarı (KDV dahil)" value={formatMoney(c.totals.contractTotal, cur)} />
            <Figure label="Teslim alınan (onaylı, KDV dahil)" value={formatMoney(c.totals.delivered, cur)} />
            <Figure label="Ödenen" value={formatMoney(c.totals.paid, cur)} note="Plan + bağlı avanslar" />
            <Figure
              label="Avans bakiyesi"
              value={formatMoney(c.totals.advance, cur)}
              note={c.totals.advance.isNegative() ? "Teslim alınanın ödemesi bekliyor" : "Ödenen − teslim alınan"}
            />
            <Figure label="Planlanan, ödenmemiş" value={formatMoney(c.totals.unpaidPlan, cur)} />
            <Figure label="Faturalanan" value={formatMoney(c.totals.invoiced, cur)} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Kalemler ve proje tahsisi</CardTitle>
            <CardDescription>Bakiye: toplam = çekilen + kalan. Çekiş önce projenin tahsisinden, yetmezse havuzdan düşer.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            {c.items.map((item) => {
              const b = item.balance;
              const pct = b.total.isZero() ? 0 : b.drawn.div(b.total).times(100).toNumber();
              return (
                <div key={item.id} className="grid gap-2 rounded-lg border p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium">{item.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.costItemCode} · {formatMoney(item.unitPrice, cur)} / {item.unit} · KDV %{formatNumber(item.vatRate)}
                      </p>
                    </div>
                    {canManage && (
                      <AllocationButton
                        projects={projects.map((p) => ({ id: p.id, name: p.name }))}
                        item={{
                          id: item.id,
                          description: item.description,
                          unit: item.unit,
                          total: b.total.toString(),
                          allocations: b.byProject.map((p) => ({ projectId: p.projectId, quantity: p.allocated.toString(), drawn: p.drawn.toString() })),
                        }}
                      />
                    )}
                  </div>
                  <Meter value={pct} />
                  <p className="text-sm tabular-nums">
                    Toplam {formatNumber(b.total, 4)} · çekilen {formatNumber(b.drawn, 4)}
                    {b.drawn.gt(b.drawnApproved) && <span className="text-amber-700"> ({formatNumber(b.drawn.minus(b.drawnApproved), 4)} onay bekliyor)</span>} · kalan{" "}
                    <strong>{formatNumber(b.remaining, 4)}</strong> {item.unit}
                  </p>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Proje</TableHead>
                        <TableHead className="text-right">Tahsis</TableHead>
                        <TableHead className="text-right">Çekilen</TableHead>
                        <TableHead className="text-right">Kalan</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {b.byProject.map((p) => (
                        <TableRow key={p.projectId}>
                          <TableCell>{projectName[p.projectId] ?? "?"}</TableCell>
                          <TableCell className="text-right tabular-nums">{formatNumber(p.allocated, 4)}</TableCell>
                          <TableCell className="text-right tabular-nums">{formatNumber(p.drawn, 4)}</TableCell>
                          <TableCell className="text-right tabular-nums">{formatNumber(p.remaining, 4)}</TableCell>
                        </TableRow>
                      ))}
                      <TableRow>
                        <TableCell className="text-muted-foreground">Atanmamış – şirket geneli havuz</TableCell>
                        <TableCell className="text-right tabular-nums">{formatNumber(b.pool, 4)}</TableCell>
                        <TableCell />
                        <TableCell className="text-right tabular-nums">{formatNumber(b.pool, 4)}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Çekişler (teslimatlar)</CardTitle>
            <CardDescription>Şantiyeden “Malzeme geldi” ile girilir; maliyet projeye bağlantı fiyatıyla yazılır.</CardDescription>
          </CardHeader>
          <CardContent>
            {draws.length === 0 ? (
              <p className="text-sm text-muted-foreground">Henüz çekiş yok.</p>
            ) : (
              <ul className="grid gap-2 text-sm">
                {draws.map((d) => (
                  <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-2.5">
                    <span className="min-w-0">
                      {d.link ? (
                        <Link href={`/projects/${d.projectId}/expenses/${d.id}`} className="font-medium hover:underline">
                          {formatDateOnly(d.date)} · {projectName[d.projectId]}
                        </Link>
                      ) : (
                        <span className="font-medium">
                          {formatDateOnly(d.date)} · {projectName[d.projectId]}
                        </span>
                      )}
                      <span className="block text-xs text-muted-foreground">
                        {d.connectionItemId ? itemName.get(d.connectionItemId)?.description : ""}
                        {d.documentNo && ` · irsaliye ${d.documentNo}`}
                        {d.block && ` · ${d.block.name}`} · {d.createdBy.name}
                        {d._count.documents === 0 && " · fotoğrafsız"}
                      </span>
                    </span>
                    <span className="flex items-center gap-2">
                      <ApprovalBadge status={d.approvalStatus} />
                      <span className="text-right tabular-nums">
                        {formatNumber(d.quantity, 4)} {d.unit}
                        <span className="block text-xs text-muted-foreground">{formatMoney(d.totalAmount, cur)}</span>
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Ödeme planı</CardTitle>
              <CardDescription>Ödenmeyenler vade listesinde de görünür.</CardDescription>
            </CardHeader>
            <CardContent>
              <PaymentsPanel
                connectionId={c.id}
                currency={cur}
                canManage={canManage}
                today={dateToDateInput(today)}
                payments={c.payments.map((p) => ({
                  id: p.id,
                  dueDate: p.dueDate.toISOString(),
                  amount: p.amount.toString(),
                  amountTry: p.amountTry.toString(),
                  description: p.description,
                  paymentMethod: p.paymentMethod,
                  instrumentNo: p.instrumentNo,
                  paymentStatus: p.paymentStatus,
                  paidAt: p.paidAt?.toISOString() ?? null,
                  overdue: dueBucket(p.dueDate, today) === "overdue",
                }))}
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Bağlı avanslar</CardTitle>
              <CardDescription>Harcama olarak girilmiş avans ödemeleri; ödenenler avans bakiyesine eklenir.</CardDescription>
            </CardHeader>
            <CardContent>
              <AdvancesPanel
                connectionId={c.id}
                currency={cur}
                canManage={canManage}
                linked={advances.map((a) => ({
                  id: a.id,
                  date: a.date.toISOString(),
                  project: projectName[a.projectId] ?? "?",
                  amount: a.totalAmount.toString(),
                  documentNo: a.documentNo,
                  paymentStatus: a.paymentStatus,
                  href: a.link ? `/projects/${a.projectId}/expenses/${a.id}` : null,
                }))}
                linkable={linkable.map((a) => ({
                  id: a.id,
                  date: a.date.toISOString(),
                  project: a.project.name,
                  amount: a.totalAmount.toString(),
                  documentNo: a.documentNo,
                  paymentStatus: a.paymentStatus,
                  href: `/projects/${a.projectId}/expenses/${a.id}`,
                }))}
              />
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Faturalar</CardTitle>
            <CardDescription>Tedarikçi faturaları bağlantı fiyatı ve teslim alınan miktarla karşılaştırılır.</CardDescription>
          </CardHeader>
          <CardContent>
            <InvoicesPanel
              connectionId={c.id}
              currency={cur}
              canManage={canManage}
              today={dateToDateInput(today)}
              items={c.items.map((i) => ({ id: i.id, description: i.description, unit: i.unit, unitPrice: i.unitPrice.toString(), vatRate: i.vatRate.toString() }))}
              invoices={c.invoices.map((inv) => ({
                id: inv.id,
                date: inv.date.toISOString(),
                documentNo: inv.documentNo,
                totalAmount: inv.totalAmount.toString(),
                totalAmountTry: inv.totalAmountTry.toString(),
                warnings: inv.warnings,
                lines: inv.lines.map((l) => ({
                  description: itemName.get(l.itemId)?.description ?? "?",
                  unit: itemName.get(l.itemId)?.unit ?? "",
                  quantity: l.quantity.toString(),
                  unitPrice: l.unitPrice.toString(),
                })),
                documents: inv.documents,
              }))}
            />
          </CardContent>
        </Card>

        {gains.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Bağlantı kazancı</CardTitle>
              <CardDescription>
                (Güncel fiyat − bağlantı fiyatı) × bağlantı miktarı. Güncel fiyat kütüphaneden: son alım (fatura) → teklif → piyasa.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-2 text-sm">
              {gains.map((g) => (
                <div key={g.itemId} className="flex flex-wrap items-center justify-between gap-2">
                  <span>
                    {g.description}: bağlantı {g.connectionPriceTry ? formatMoney(g.connectionPriceTry) : "—"} · güncel {g.marketPriceTry ? formatMoney(g.marketPriceTry) : "—"} / {g.unit}
                  </span>
                  <span className={g.gain?.isNegative() ? "font-medium text-destructive tabular-nums" : "font-medium tabular-nums"}>
                    {g.gain ? formatMoney(g.gain) : "Güncel fiyat yok"}
                  </span>
                </div>
              ))}
              {gains.length > 1 && (
                <p className="border-t pt-2 text-right font-semibold tabular-nums">Toplam {formatMoney(totalGain)}</p>
              )}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Bilgiler</CardTitle>
          </CardHeader>
          <CardContent>
            <InfoList
              items={[
                { label: "Geçerlilik sonu", value: c.validUntil ? formatDateOnly(c.validUntil) : null },
                { label: "Son çekiş tarihi", value: c.lastDrawDate ? formatDateOnly(c.lastDrawDate) : null },
                ...(c.priceType === "FIXED_UNTIL" ? [{ label: "Fiyat sabit", value: c.priceFixedUntil ? `${formatDateOnly(c.priceFixedUntil)} tarihine kadar` : null }] : []),
                { label: "Teslim yeri", value: c.deliveryPlace },
                { label: "Nakliye / boşaltma", value: `${c.transportIncluded ? "Nakliye dahil" : "Nakliye hariç"} · ${c.unloadingIncluded ? "boşaltma dahil" : "boşaltma hariç"}` },
                { label: "Notlar", value: c.notes },
                { label: "Giren", value: c.createdBy.name },
              ]}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Sözleşme / teklif belgeleri</CardTitle>
          </CardHeader>
          <CardContent>
            <DocumentGallery documents={c.documents} />
          </CardContent>
        </Card>

        {history.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Tahsis geçmişi</CardTitle>
              <CardAction />
            </CardHeader>
            <CardContent>
              <ul className="grid gap-1.5 text-sm">
                {history.map((h) => {
                  const changes = (h.changes ?? {}) as { before?: Record<string, string>; after?: Record<string, string>; fromPool?: string; newAllocation?: string };
                  const item = itemName.get(h.entityId ?? "");
                  return (
                    <li key={h.id} className="text-muted-foreground">
                      <span className="text-foreground">{formatDateTime(h.createdAt)}</span> · {h.user?.name ?? "?"} · {item?.description}:{" "}
                      {h.action === "auto_allocate"
                        ? `çekişte havuzdan ${formatNumber(changes.fromPool ?? 0, 4)} ${item?.unit ?? ""} otomatik tahsis`
                        : `${Object.entries(changes.before ?? {}).map(([k, v]) => `${k} ${formatNumber(v, 4)}`).join(", ") || "—"} → ${
                            Object.entries(changes.after ?? {}).map(([k, v]) => `${k} ${formatNumber(v, 4)}`).join(", ") || "—"
                          }`}
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}
