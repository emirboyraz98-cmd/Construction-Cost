import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeftIcon } from "lucide-react";
import { InfoList } from "@/components/info-list";
import { PageHeader } from "@/components/page-header";
import { NoAccess } from "@/components/purchasing/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { hasCapability } from "@/lib/auth/roles";
import { PRICE_SOURCE_LABELS, RESOURCE_TYPE_LABELS } from "@/lib/budget/labels";
import { dateToDateInput, decimalToInput, formatDateOnly, formatMoney, formatNumber } from "@/lib/format";
import { getAccess } from "@/server/access";
import { getResource, manualPrices } from "@/server/library";
import { supplierOptions } from "@/server/suppliers";
import { AddPriceButton, DeletePriceButton, EditResourceButton, priceText } from "../../library-panels";

export const metadata: Metadata = { title: "Kaynak" };

export default async function ResourcePage({ params }: PageProps<"/company/library/resources/[resourceId]">) {
  const { resourceId } = await params;
  const { user } = await getAccess();
  if (!hasCapability(user.role, "library.view")) return <NoAccess text="Kütüphaneyi görme yetkiniz yok." />;
  const [data, manual, suppliers] = await Promise.all([getResource(resourceId), manualPrices(resourceId), supplierOptions()]);
  if (!data) notFound();
  const r = data.resource;
  const supplierList = suppliers.map((s) => ({ id: s.id, name: s.name }));

  return (
    <>
      <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2">
        <Link href="/company/library">
          <ArrowLeftIcon />
          Kütüphane
        </Link>
      </Button>
      <PageHeader
        title={r.name}
        description={`${r.code} · ${RESOURCE_TYPE_LABELS[r.type]} · ${r.unit}`}
        actions={
          data.canManage && (
            <>
              <AddPriceButton resourceId={r.id} currency={r.currency} today={dateToDateInput(new Date())} suppliers={supplierList} />
              <EditResourceButton
                resourceId={r.id}
                suppliers={supplierList}
                initial={{
                  code: r.code,
                  name: r.name,
                  type: r.type,
                  category: r.category ?? "",
                  unit: r.unit,
                  wastePercent: decimalToInput(r.wastePercent),
                  currency: r.currency,
                  spec: r.spec ?? "",
                  defaultSupplierId: r.defaultSupplierId,
                  active: r.active,
                }}
              />
            </>
          )
        }
      >
        {!r.active && <Badge variant="secondary" className="mt-2">Pasif</Badge>}
      </PageHeader>

      <div className="grid max-w-4xl grid-cols-1 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Bütçede kullanılan fiyat</CardTitle>
            <CardDescription>Öncelik: geçerli bağlantı fiyatı → son alım (fatura) → teklif → piyasa araştırması.</CardDescription>
          </CardHeader>
          <CardContent>
            {data.effective ? (
              <p className="text-lg font-semibold tabular-nums">
                {priceText(data.effective.price.toString(), data.effective.currency)} / {r.unit}
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  {PRICE_SOURCE_LABELS[data.effective.kind]} · {formatDateOnly(data.effective.date)}
                  {data.effective.currency !== "TRY" && (data.effectiveTry ? ` · ${formatMoney(data.effectiveTry)} (son kur)` : " · kur yok")}
                </span>
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">Fiyat yok. Teklif / piyasa fiyatı ekleyin, faturaları eşleştirin veya bağlantı kalemine bu kaynağı seçin.</p>
            )}
          </CardContent>
        </Card>

        <Card className="gap-0 pb-0">
          <CardHeader className="pb-4">
            <CardTitle>Fiyat geçmişi</CardTitle>
            <CardAction />
          </CardHeader>
          {data.history.length === 0 ? (
            <CardContent className="pb-6 text-sm text-muted-foreground">Kayıt yok.</CardContent>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">Tarih</TableHead>
                  <TableHead>Kaynak</TableHead>
                  <TableHead>Açıklama</TableHead>
                  <TableHead className="pr-4 text-right">Fiyat</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.history.map((h, i) => (
                  <TableRow key={i}>
                    <TableCell className="pl-4 whitespace-nowrap">{formatDateOnly(h.date)}</TableCell>
                    <TableCell>{PRICE_SOURCE_LABELS[h.kind]}</TableCell>
                    <TableCell className="max-w-64 truncate text-muted-foreground">{h.label || "—"}</TableCell>
                    <TableCell className="pr-4 text-right tabular-nums">{priceText(h.price.toString(), h.currency)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>

        {data.canManage && manual.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Teklif ve piyasa fiyatları</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="grid gap-1.5 text-sm">
                {manual.map((p) => (
                  <li key={p.id} className="flex flex-wrap items-center justify-between gap-2">
                    <span>
                      {formatDateOnly(p.date)} · {PRICE_SOURCE_LABELS[p.source]}
                      {p.supplier && ` · ${p.supplier.name}`}
                      {p.note && <span className="text-muted-foreground"> · {p.note}</span>}
                    </span>
                    <span className="flex items-center gap-1 tabular-nums">
                      {priceText(p.price.toString(), p.currency)}
                      <DeletePriceButton priceId={p.id} />
                    </span>
                  </li>
                ))}
              </ul>
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
                { label: "Kategori", value: r.category },
                { label: "Fire", value: `%${formatNumber(r.wastePercent)}` },
                { label: "Marka / özellik", value: r.spec },
                { label: "Varsayılan tedarikçi", value: r.defaultSupplier?.name ?? null },
                {
                  label: "Kullanıldığı reçeteler",
                  value: data.recipes.length
                    ? data.recipes.map((rc) => `${rc.code} ${rc.name}`).join(", ")
                    : null,
                },
              ]}
            />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
