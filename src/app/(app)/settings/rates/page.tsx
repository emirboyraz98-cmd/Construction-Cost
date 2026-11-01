import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { hasCapability } from "@/lib/auth/roles";
import { dateToDateInput, formatDateOnly, formatNumber } from "@/lib/format";
import { getAccess } from "@/server/access";
import { listRates } from "@/server/rates";
import { RatesPanel } from "./rates-panel";

export const metadata: Metadata = { title: "Döviz kurları" };

export default async function RatesPage() {
  const { user } = await getAccess();
  if (!hasCapability(user.role, "rates.manage")) {
    return (
      <Card className="max-w-xl">
        <CardContent className="text-sm text-muted-foreground">Kurları yalnızca yönetici ve muhasebe yönetebilir.</CardContent>
      </Card>
    );
  }
  const rates = await listRates(90);
  return (
    <>
      <PageHeader
        title="Döviz kurları"
        description="Dövizli harcama ve bağlantılarda kullanılacak kurlar. TCMB'den getirin veya elle girin."
      />
      <RatesPanel today={dateToDateInput(new Date())} />
      <Card className="mt-4 py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4">Tarih</TableHead>
              <TableHead>Para birimi</TableHead>
              <TableHead className="text-right">Döviz alış</TableHead>
              <TableHead className="text-right">Döviz satış</TableHead>
              <TableHead className="pr-4">Kaynak</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rates.map((rate) => (
              <TableRow key={rate.id}>
                <TableCell className="pl-4">{formatDateOnly(rate.date)}</TableCell>
                <TableCell>{rate.currency}</TableCell>
                <TableCell className="text-right tabular-nums">{formatNumber(rate.buying, 4)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatNumber(rate.selling, 4)}</TableCell>
                <TableCell className="pr-4">{rate.source === "TCMB" ? "TCMB" : "Elle"}</TableCell>
              </TableRow>
            ))}
            {rates.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-6 text-center text-muted-foreground">
                  Henüz kur kaydı yok.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}
