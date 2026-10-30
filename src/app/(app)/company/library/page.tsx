import type { Metadata } from "next";
import Link from "next/link";
import { SearchIcon } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { NoAccess } from "@/components/purchasing/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ResourceType } from "@/generated/prisma/enums";
import { hasCapability } from "@/lib/auth/roles";
import { PRICE_SOURCE_LABELS, RESOURCE_TYPE_LABELS, priceText } from "@/lib/budget/labels";
import { formatDateOnly, formatMoney, formatNumber } from "@/lib/format";
import { getAccess } from "@/server/access";
import { listResources } from "@/server/library";
import { supplierOptions } from "@/server/suppliers";
import { LibraryTabs, NewResourceButton } from "./library-panels";

export const metadata: Metadata = { title: "Kütüphane" };

export default async function LibraryPage({ searchParams }: PageProps<"/company/library">) {
  const { user } = await getAccess();
  if (!hasCapability(user.role, "library.view")) return <NoAccess text="Kütüphaneyi görme yetkiniz yok." />;
  const params = await searchParams;
  const query = typeof params.q === "string" ? params.q : "";
  const type = typeof params.tur === "string" && params.tur in ResourceType ? (params.tur as ResourceType) : null;
  const [{ rows, canManage }, suppliers] = await Promise.all([listResources({ query, type }), supplierOptions()]);

  return (
    <>
      <PageHeader
        title="Malzeme & fiyat kütüphanesi"
        description="Malzeme, işçilik, makine ve hizmetler. Bütçede fiyat önceliği: geçerli bağlantı fiyatı → son alım (fatura) → teklif → piyasa."
        actions={canManage && <NewResourceButton suppliers={suppliers.map((s) => ({ id: s.id, name: s.name }))} />}
      />
      <LibraryTabs />
      <form className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-56 flex-1 sm:max-w-sm">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input name="q" defaultValue={query} placeholder="Kod, ad veya kategori" className="pl-9" aria-label="Kaynak ara" />
        </div>
        <NativeSelect name="tur" defaultValue={type ?? ""} className="w-44" aria-label="Tür">
          <option value="">Tüm türler</option>
          {Object.entries(RESOURCE_TYPE_LABELS).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </NativeSelect>
        <Button type="submit" variant="outline">
          Ara
        </Button>
      </form>
      {rows.length === 0 ? (
        <Card>
          <CardContent className="py-6 text-center text-sm text-muted-foreground">
            Kaynak yok. “Yeni kaynak” ile ekleyin veya “Faturalardan fiyat” sekmesinde faturalardan oluşturun.
          </CardContent>
        </Card>
      ) : (
        <Card className="py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Kaynak</TableHead>
                <TableHead>Tür</TableHead>
                <TableHead>Birim</TableHead>
                <TableHead className="text-right">Fire</TableHead>
                <TableHead className="pr-4 text-right">Geçerli fiyat (KDV hariç)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="pl-4">
                    <Link href={`/company/library/resources/${r.id}`} className="font-medium hover:underline">
                      {r.name}
                    </Link>
                    <span className="block text-xs text-muted-foreground">
                      {r.code}
                      {r.category && ` · ${r.category}`}
                    </span>
                  </TableCell>
                  <TableCell>{RESOURCE_TYPE_LABELS[r.type]}</TableCell>
                  <TableCell>{r.unit}</TableCell>
                  <TableCell className="text-right tabular-nums">%{formatNumber(r.wastePercent)}</TableCell>
                  <TableCell className="pr-4 text-right tabular-nums">
                    {r.price.candidate ? (
                      <>
                        {r.price.candidate.currency === "TRY" ? formatMoney(r.price.candidate.price) : priceText(r.price.candidate.price.toString(), r.price.candidate.currency)}
                        <span className="block text-xs text-muted-foreground">
                          {PRICE_SOURCE_LABELS[r.price.candidate.kind]} · {formatDateOnly(r.price.candidate.date)}
                          {r.price.candidate.currency !== "TRY" && r.price.priceTry && ` · ${formatMoney(r.price.priceTry)}`}
                        </span>
                      </>
                    ) : (
                      <span className="text-muted-foreground">Fiyat yok</span>
                    )}
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
