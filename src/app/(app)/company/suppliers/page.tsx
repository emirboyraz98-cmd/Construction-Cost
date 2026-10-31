import type { Metadata } from "next";
import Link from "next/link";
import { PlusIcon, SearchIcon } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { hasCapability } from "@/lib/auth/roles";
import { SUPPLIER_KIND_LABELS } from "@/lib/expenses/labels";
import { formatMoney } from "@/lib/format";
import { getAccess } from "@/server/access";
import { listSuppliers } from "@/server/suppliers";

export const metadata: Metadata = { title: "Tedarikçiler" };

export default async function SuppliersPage({ searchParams }: PageProps<"/company/suppliers">) {
  const { user } = await getAccess();
  if (!hasCapability(user.role, "supplier.view")) {
    return (
      <>
        <PageHeader title="Tedarikçiler" />
        <Card className="max-w-xl">
          <CardContent className="text-sm text-muted-foreground">Tedarikçileri görme yetkiniz yok.</CardContent>
        </Card>
      </>
    );
  }
  const params = await searchParams;
  const query = typeof params.q === "string" ? params.q : "";
  const includeInactive = params.pasif === "1";
  const { suppliers, showBalances } = await listSuppliers({ query, includeInactive });
  const canManage = hasCapability(user.role, "supplier.manage");

  return (
    <>
      <PageHeader
        title="Tedarikçiler / taşeronlar"
        description="Malzeme aldığınız firmalar ve taşeronlar; ne alındı, ne ödendi (KDV dahil)."
        actions={
          canManage && (
            <Button asChild>
              <Link href="/company/suppliers/new">
                <PlusIcon />
                Tedarikçi ekle
              </Link>
            </Button>
          )
        }
      />
      <form className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-64 flex-1 sm:max-w-sm">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input name="q" defaultValue={query} placeholder="Ad veya vergi no" className="pl-9" aria-label="Tedarikçi ara" />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="pasif" value="1" defaultChecked={includeInactive} className="size-4" />
          Pasifleri de göster
        </label>
        <Button type="submit" variant="outline">
          Ara
        </Button>
      </form>

      {suppliers.length === 0 ? (
        <Card>
          <CardContent className="py-6 text-center text-sm text-muted-foreground">
            {query ? "Aramaya uyan tedarikçi yok." : "Henüz tedarikçi yok. Harcama girerken de eklenebilir."}
          </CardContent>
        </Card>
      ) : (
        <Card className="py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Ad</TableHead>
                <TableHead>Vergi / TC no</TableHead>
                <TableHead>Tür</TableHead>
                {showBalances && (
                  <>
                    <TableHead className="text-right">Toplam</TableHead>
                    <TableHead className="text-right">Ödenmemiş</TableHead>
                    <TableHead className="pr-4 text-right">Avans</TableHead>
                  </>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {suppliers.map((supplier) => (
                <TableRow key={supplier.id}>
                  <TableCell className="max-w-72 truncate pl-4">
                    <Link href={`/company/suppliers/${supplier.id}`} className="font-medium hover:underline">
                      {supplier.name}
                    </Link>
                    {!supplier.active && (
                      <Badge variant="outline" className="ml-2">
                        Pasif
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="tabular-nums">{supplier.taxNumber ?? "—"}</TableCell>
                  <TableCell>{SUPPLIER_KIND_LABELS[supplier.kind]}</TableCell>
                  {showBalances && (
                    <>
                      <TableCell className="text-right tabular-nums">{formatMoney(supplier.balance?.invoiced ?? 0)}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {supplier.balance?.unpaid.gt(0) ? (
                          <span className="font-medium text-amber-800">{formatMoney(supplier.balance.unpaid)}</span>
                        ) : (
                          formatMoney(0)
                        )}
                      </TableCell>
                      <TableCell className="pr-4 text-right tabular-nums">{formatMoney(supplier.balance?.advances ?? 0)}</TableCell>
                    </>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </>
  );
}
