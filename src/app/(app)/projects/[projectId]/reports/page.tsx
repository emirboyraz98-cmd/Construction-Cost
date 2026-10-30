import type { Metadata } from "next";
import Link from "next/link";
import { DownloadIcon } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { hasCapability } from "@/lib/auth/roles";
import { dateInputToDate, dateToDateInput, Decimal, formatMoney, formatNumber } from "@/lib/format";
import { requireProjectAccess } from "@/server/access";
import { projectExpenseReport } from "@/server/reports";

export const metadata: Metadata = { title: "Harcama raporları" };

const MONTHS = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
const monthLabel = (key: string) => `${MONTHS[Number(key.slice(5, 7)) - 1]} ${key.slice(0, 4)}`;

function Share({ value, total }: { value: Decimal; total: Decimal }) {
  const percent = total.isZero() ? new Decimal(0) : value.div(total).times(100);
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-muted" aria-hidden>
        <div className="h-full rounded-full bg-primary" style={{ width: `${percent.toDecimalPlaces(1).toString()}%` }} />
      </div>
      <span className="w-12 text-right text-xs text-muted-foreground tabular-nums">%{formatNumber(percent, 1)}</span>
    </div>
  );
}

export default async function ReportsPage({ params, searchParams }: PageProps<"/projects/[projectId]/reports">) {
  const { projectId } = await params;
  const { role } = await requireProjectAccess(projectId);
  if (!hasCapability(role, "expense.viewAll")) {
    return (
      <>
        <PageHeader title="Raporlar" />
        <Card className="max-w-xl">
          <CardContent className="text-sm text-muted-foreground">Bu projenin harcama raporlarını görme yetkiniz yok.</CardContent>
        </Card>
      </>
    );
  }
  const query = await searchParams;
  const from = dateInputToDate(typeof query.from === "string" ? query.from : null);
  const to = dateInputToDate(typeof query.to === "string" ? query.to : null);
  const includePending = query.bekleyen === "1";
  const report = await projectExpenseReport(projectId, { from, to, includePending });
  const total = report.totals.net;
  const exportParams = new URLSearchParams();
  if (from) exportParams.set("from", dateToDateInput(from));
  if (to) exportParams.set("to", dateToDateInput(to));
  if (!includePending) exportParams.set("status", "APPROVED");

  return (
    <>
      <PageHeader
        title="Harcama raporları"
        description="Tutarlar TL, KDV hariç (matrah). Bütçe Faz 3'te eklendiğinde bütçe/sapma sütunları gelecek."
        actions={
          <Button asChild variant="outline">
            <a href={`/api/projects/${projectId}/expenses/export?${exportParams.toString()}`}>
              <DownloadIcon />
              Kayıtları Excel&apos;e aktar
            </a>
          </Button>
        }
      />

      <form className="mb-4 flex flex-wrap items-end gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="from">Başlangıç</Label>
          <Input id="from" name="from" type="date" defaultValue={dateToDateInput(from)} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="to">Bitiş</Label>
          <Input id="to" name="to" type="date" defaultValue={dateToDateInput(to)} />
        </div>
        <label className="flex h-9 items-center gap-2 text-sm">
          <input type="checkbox" name="bekleyen" value="1" defaultChecked={includePending} className="size-4" />
          Onay bekleyenleri de say
        </label>
        <Button type="submit">Uygula</Button>
        <Button asChild variant="ghost">
          <Link href="?">Temizle</Link>
        </Button>
      </form>

      <Card className="mb-4 py-4">
        <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <p className="text-xs text-muted-foreground">Harcama (KDV hariç)</p>
            <p className="text-lg font-semibold tabular-nums">{formatMoney(report.totals.net)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">KDV</p>
            <p className="text-lg font-semibold tabular-nums">{formatMoney(report.totals.vat)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">KDV dahil</p>
            <p className="text-lg font-semibold tabular-nums">{formatMoney(report.totals.total)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Verilen avans (maliyete dahil değil)</p>
            <p className="text-lg font-semibold tabular-nums">{formatMoney(report.advances.total)}</p>
          </div>
        </CardContent>
      </Card>

      {report.totals.count === 0 ? (
        <Card>
          <CardContent className="py-6 text-center text-sm text-muted-foreground">Seçilen dönemde harcama yok.</CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          <Card className="gap-2 py-0 xl:col-span-2">
            <CardHeader className="pt-5">
              <CardTitle>Maliyet kalemlerine göre</CardTitle>
              <CardDescription>Ana grup ve altındaki kalemler</CardDescription>
            </CardHeader>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">Kalem</TableHead>
                  <TableHead className="text-right">Kayıt</TableHead>
                  <TableHead className="text-right">Matrah</TableHead>
                  <TableHead className="pr-4">Pay</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.byGroup.flatMap((group) => [
                  <TableRow key={group.code} className="bg-muted/40 font-medium">
                    <TableCell className="pl-4">
                      {group.code} {group.name}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{group.sum.count}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatMoney(group.sum.net)}</TableCell>
                    <TableCell className="pr-4">
                      <Share value={group.sum.net} total={total} />
                    </TableCell>
                  </TableRow>,
                  ...group.items
                    .filter((item) => item.code !== group.code)
                    .map((item) => (
                      <TableRow key={`${group.code}-${item.code}`}>
                        <TableCell className="pl-8 text-muted-foreground">
                          {item.code} {item.name}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{item.sum.count}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatMoney(item.sum.net)}</TableCell>
                        <TableCell className="pr-4">
                          <Share value={item.sum.net} total={total} />
                        </TableCell>
                      </TableRow>
                    )),
                ])}
              </TableBody>
            </Table>
          </Card>

          <Card className="gap-2 py-0">
            <CardHeader className="pt-5">
              <CardTitle>Aylara göre</CardTitle>
            </CardHeader>
            <Table>
              <TableBody>
                {report.byMonth.map(({ month, sum }) => (
                  <TableRow key={month}>
                    <TableCell className="pl-4">{monthLabel(month)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatMoney(sum.net)}</TableCell>
                    <TableCell className="pr-4">
                      <Share value={sum.net} total={total} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>

          <Card className="gap-2 py-0">
            <CardHeader className="pt-5">
              <CardTitle>Bloklara göre</CardTitle>
            </CardHeader>
            <Table>
              <TableBody>
                {report.byBlock.map((block) => (
                  <TableRow key={block.id ?? "ortak"}>
                    <TableCell className="pl-4">{block.name}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatMoney(block.sum.net)}</TableCell>
                    <TableCell className="pr-4">
                      <Share value={block.sum.net} total={total} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>

          <Card className="gap-2 py-0 xl:col-span-2">
            <CardHeader className="pt-5">
              <CardTitle>Tedarikçilere göre</CardTitle>
            </CardHeader>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">Tedarikçi</TableHead>
                  <TableHead className="text-right">Kayıt</TableHead>
                  <TableHead className="text-right">Matrah</TableHead>
                  <TableHead className="text-right">KDV dahil</TableHead>
                  <TableHead className="pr-4">Pay</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.bySupplier.map((supplier) => (
                  <TableRow key={supplier.id ?? "yok"}>
                    <TableCell className="pl-4">
                      {supplier.id ? (
                        <Link href={`/company/suppliers/${supplier.id}`} className="hover:underline">
                          {supplier.name}
                        </Link>
                      ) : (
                        supplier.name
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{supplier.sum.count}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatMoney(supplier.sum.net)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatMoney(supplier.sum.total)}</TableCell>
                    <TableCell className="pr-4">
                      <Share value={supplier.sum.net} total={total} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </div>
      )}
    </>
  );
}
