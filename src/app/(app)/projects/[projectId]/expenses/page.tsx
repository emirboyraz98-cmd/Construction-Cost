import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DownloadIcon, FilterIcon, PackageCheckIcon, PlusIcon, SheetIcon } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { hasCapability } from "@/lib/auth/roles";
import { codeDepth } from "@/lib/cost-tree/tree";
import { filtersToSearchParams, hasActiveFilters, parseExpenseFilters } from "@/lib/expenses/filters";
import { APPROVAL_STATUS_LABELS, EXPENSE_KIND_LABELS, PAYMENT_STATUS_LABELS } from "@/lib/expenses/labels";
import { dueBucket } from "@/lib/expenses/payables";
import { dateToDateInput, formatMoney } from "@/lib/format";
import { db } from "@/server/db";
import { listExpenses } from "@/server/expenses";
import { supplierOptions } from "@/server/suppliers";
import { ExpenseTable } from "./expense-table";

export const metadata: Metadata = { title: "Harcamalar" };

export default async function ExpensesPage({ params, searchParams }: PageProps<"/projects/[projectId]/expenses">) {
  const { projectId } = await params;
  const filters = parseExpenseFilters(await searchParams);
  const result = await listExpenses(projectId, filters);
  if (!result) {
    return (
      <>
        <PageHeader title="Harcamalar" />
        <Card className="max-w-xl">
          <CardContent className="text-sm text-muted-foreground">Bu projede harcamaları görme yetkiniz yok.</CardContent>
        </Card>
      </>
    );
  }
  const [costItems, suppliers, project] = await Promise.all([
    db.costItem.findMany({ where: { projectId }, orderBy: { sortOrder: "asc" }, select: { id: true, code: true, name: true } }),
    supplierOptions(),
    db.project.findUnique({ where: { id: projectId }, select: { name: true } }),
  ]);
  if (!project) notFound();

  const { role } = result;
  const viewAll = hasCapability(role, "expense.viewAll");
  const canCreate = hasCapability(role, "expense.create");
  const today = new Date();
  const pages = Math.max(1, Math.ceil(result.count / result.pageSize));
  const exportQuery = filtersToSearchParams({ ...filters, page: 1 }).toString();
  const pageHref = (page: number) => `?${filtersToSearchParams({ ...filters, page }).toString()}`;

  return (
    <>
      <PageHeader
        title={viewAll ? "Harcamalar" : "Son girişlerim"}
        description={
          viewAll
            ? `${project.name} · harcama, avans, bağlantı çekişi, hakediş ve transfer kayıtları`
            : "Bu projede sizin girdiğiniz harcamalar. Ofis onayladıkça durumları değişir."
        }
        actions={
          <>
            {canCreate && (
              <Button asChild size="lg" className="md:h-9">
                <Link href={`/projects/${projectId}/expenses/new`}>
                  <PlusIcon />
                  Harcama gir
                </Link>
              </Button>
            )}
            {canCreate && (
              <Button asChild variant="outline" size="lg" className="md:h-9">
                <Link href={`/projects/${projectId}/expenses/delivery`}>
                  <PackageCheckIcon />
                  Malzeme geldi
                </Link>
              </Button>
            )}
            {canCreate && (
              <Button asChild variant="outline">
                <Link href={`/projects/${projectId}/expenses/batch`}>
                  <SheetIcon />
                  Toplu giriş / Excel
                </Link>
              </Button>
            )}
            {viewAll && (
              <Button asChild variant="outline">
                <a href={`/api/projects/${projectId}/expenses/export?${exportQuery}`}>
                  <DownloadIcon />
                  Excel&apos;e aktar
                </a>
              </Button>
            )}
          </>
        }
      />

      {result.pending > 0 && hasCapability(role, "expense.approve") && filters.status !== "PENDING" && (
        <Link
          href={`?status=PENDING`}
          className="mb-4 flex items-center justify-between rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900"
        >
          <span>{result.pending} harcama onay bekliyor.</span>
          <span className="font-medium underline">Göster</span>
        </Link>
      )}

      <details className="group mb-4 rounded-lg border bg-card" open={hasActiveFilters(filters)}>
        <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-2.5 text-sm font-medium">
          <FilterIcon className="size-4" />
          Filtreler {hasActiveFilters(filters) && <span className="text-primary">(etkin)</span>}
        </summary>
        <form className="grid gap-3 border-t p-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="grid gap-1.5">
            <Label htmlFor="from">Başlangıç</Label>
            <Input id="from" name="from" type="date" defaultValue={dateToDateInput(filters.from)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="to">Bitiş</Label>
            <Input id="to" name="to" type="date" defaultValue={dateToDateInput(filters.to)} />
          </div>
          <div className="grid gap-1.5 sm:col-span-2">
            <Label htmlFor="item">Maliyet kalemi (alt kalemler dahil)</Label>
            <NativeSelect id="item" name="item" defaultValue={filters.costItemId ?? ""}>
              <option value="">Tümü</option>
              {costItems.map((item) => (
                <option key={item.id} value={item.id}>
                  {"  ".repeat(codeDepth(item.code))}
                  {item.code} {item.name}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="supplier">Tedarikçi</Label>
            <NativeSelect id="supplier" name="supplier" defaultValue={filters.supplierId ?? ""}>
              <option value="">Tümü</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="status">Onay</Label>
            <NativeSelect id="status" name="status" defaultValue={filters.status ?? ""}>
              <option value="">Tümü</option>
              {Object.entries(APPROVAL_STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="payment">Ödeme</Label>
            <NativeSelect id="payment" name="payment" defaultValue={filters.payment ?? ""}>
              <option value="">Tümü</option>
              {Object.entries(PAYMENT_STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="kind">Kayıt türü</Label>
            <NativeSelect id="kind" name="kind" defaultValue={filters.kind ?? ""}>
              <option value="">Tümü</option>
              {Object.entries(EXPENSE_KIND_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="grid gap-1.5 sm:col-span-2">
            <Label htmlFor="q">Ara (açıklama, belge no, tedarikçi)</Label>
            <Input id="q" name="q" defaultValue={filters.query ?? ""} />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="nodoc" value="1" defaultChecked={filters.missingDocument} className="size-4" />
            Yalnızca belgesiz kayıtlar
          </label>
          <div className="flex gap-2 sm:col-span-2 lg:col-span-1 lg:justify-end">
            <Button type="submit">Filtrele</Button>
            <Button asChild variant="ghost">
              <Link href={`/projects/${projectId}/expenses`}>Temizle</Link>
            </Button>
          </div>
        </form>
      </details>

      <Card className="mb-4 py-3">
        <CardContent className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
          <span>
            <strong>{result.count}</strong> kayıt
          </span>
          <span>
            Matrah <strong className="tabular-nums">{formatMoney(result.sums._sum.netAmountTry ?? 0)}</strong>
          </span>
          <span>
            KDV <strong className="tabular-nums">{formatMoney(result.sums._sum.vatAmountTry ?? 0)}</strong>
          </span>
          <span>
            Toplam <strong className="tabular-nums">{formatMoney(result.sums._sum.totalAmountTry ?? 0)}</strong>
          </span>
        </CardContent>
      </Card>

      {result.rows.length === 0 ? (
        <Card>
          <CardContent className="py-6 text-center text-sm text-muted-foreground">
            {hasActiveFilters(filters) ? "Filtreye uyan kayıt yok." : "Henüz harcama girilmemiş."}
          </CardContent>
        </Card>
      ) : (
        <ExpenseTable
          projectId={projectId}
          canApprove={hasCapability(role, "expense.approve")}
          canManage={hasCapability(role, "expense.manage")}
          today={dateToDateInput(today)}
          rows={result.rows.map((row) => ({
            id: row.id,
            date: row.date.toISOString(),
            kind: row.kind,
            description: row.description,
            currency: row.currency,
            totalAmount: row.totalAmount.toString(),
            totalAmountTry: row.totalAmountTry.toString(),
            documentType: row.documentType,
            documentNo: row.documentNo,
            paymentStatus: row.paymentStatus,
            dueDate: row.dueDate?.toISOString() ?? null,
            overdue: row.paymentStatus === "UNPAID" && dueBucket(row.dueDate, today) === "overdue",
            approvalStatus: row.approvalStatus,
            costItem: row.costItem ? `${row.costItem.code} ${row.costItem.name}` : null,
            supplier: row.supplier?.name ?? null,
            block: row.block?.name ?? null,
            createdBy: row.createdBy.name,
            documents: row._count.documents,
            split: Boolean(row.splitGroupId),
          }))}
        />
      )}

      {pages > 1 && (
        <nav className="mt-4 flex items-center justify-center gap-2 text-sm" aria-label="Sayfalar">
          {filters.page > 1 && (
            <Button asChild variant="outline" size="sm">
              <Link href={pageHref(filters.page - 1)}>Önceki</Link>
            </Button>
          )}
          <span>
            Sayfa {filters.page} / {pages}
          </span>
          {filters.page < pages && (
            <Button asChild variant="outline" size="sm">
              <Link href={pageHref(filters.page + 1)}>Sonraki</Link>
            </Button>
          )}
        </nav>
      )}
    </>
  );
}
