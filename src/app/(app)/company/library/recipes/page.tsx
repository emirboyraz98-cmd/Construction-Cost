import type { Metadata } from "next";
import Link from "next/link";
import { PlusIcon } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { NoAccess } from "@/components/purchasing/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { hasCapability } from "@/lib/auth/roles";
import { formatMoney } from "@/lib/format";
import { getAccess } from "@/server/access";
import { listRecipes } from "@/server/library";
import { LibraryTabs } from "../library-panels";

export const metadata: Metadata = { title: "Reçeteler" };

export default async function RecipesPage() {
  const { user } = await getAccess();
  if (!hasCapability(user.role, "library.view")) return <NoAccess text="Kütüphaneyi görme yetkiniz yok." />;
  const { rows, canManage } = await listRecipes();
  return (
    <>
      <PageHeader
        title="Birim fiyat analizleri (reçeteler)"
        description="1 birim iş için kaynak miktarları; birim fiyat kütüphane fiyatlarından hesaplanır."
        actions={
          canManage && (
            <Button asChild>
              <Link href="/company/library/recipes/new">
                <PlusIcon />
                Yeni reçete
              </Link>
            </Button>
          )
        }
      />
      <LibraryTabs />
      {rows.length === 0 ? (
        <Card>
          <CardContent className="py-6 text-center text-sm text-muted-foreground">Reçete yok.</CardContent>
        </Card>
      ) : (
        <Card className="py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Reçete</TableHead>
                <TableHead>Birim</TableHead>
                <TableHead className="text-right">Kaynak</TableHead>
                <TableHead className="text-right">Bütçede</TableHead>
                <TableHead className="pr-4 text-right">Birim fiyat</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="pl-4">
                    <Link href={`/company/library/recipes/${r.id}`} className="font-medium hover:underline">
                      {r.name}
                    </Link>
                    <span className="block text-xs text-muted-foreground">
                      {r.code}
                      {!r.active && " · pasif"}
                    </span>
                  </TableCell>
                  <TableCell>{r.unit}</TableCell>
                  <TableCell className="text-right tabular-nums">{r._count.lines}</TableCell>
                  <TableCell className="text-right tabular-nums">{r._count.budgetLines}</TableCell>
                  <TableCell className="pr-4 text-right tabular-nums">
                    {formatMoney(r.price.unitPrice)}
                    {r.price.missing > 0 && <span className="block text-xs text-amber-700">{r.price.missing} kaynak fiyatsız</span>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </>
  );
}
