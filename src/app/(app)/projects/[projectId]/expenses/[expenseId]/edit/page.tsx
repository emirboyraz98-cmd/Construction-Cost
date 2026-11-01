import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { ExpenseForm } from "@/components/expenses/expense-form";
import { valuesFromExpense } from "@/components/expenses/form-values";
import { Card, CardContent } from "@/components/ui/card";
import { isManualKind } from "@/lib/expenses/kinds";
import { entryOptions, getExpense } from "@/server/expenses";
import { vatRateOptions } from "@/server/parameters";
import { supplierOptions } from "@/server/suppliers";

export const metadata: Metadata = { title: "Harcamayı düzenle" };

export default async function EditExpensePage({ params }: PageProps<"/projects/[projectId]/expenses/[expenseId]/edit">) {
  const { projectId, expenseId } = await params;
  const detail = await getExpense(projectId, expenseId);
  if (!detail) notFound();
  if (!detail.canModify || !isManualKind(detail.expense.kind)) {
    return (
      <>
        <PageHeader title="Harcamayı düzenle" />
        <Card className="max-w-xl">
          <CardContent className="text-sm text-muted-foreground">
            {isManualKind(detail.expense.kind)
              ? "Bu kaydı değiştiremezsiniz (onaylanmış kayıtları yalnızca muhasebe / yönetici düzeltebilir)."
              : "Bağlantı çekişi, hakediş ve transfer satırları burada düzenlenmez; kendi ekranlarından yönetilir."}
          </CardContent>
        </Card>
      </>
    );
  }
  const { expense } = detail;
  const [options, suppliers, vatRates] = await Promise.all([
    entryOptions(projectId),
    supplierOptions(),
    vatRateOptions(expense.date.getUTCFullYear()),
  ]);
  // Seçili kalem artık pasifse listede yine de görünsün.
  const costItems =
    expense.costItem && !options.costItems.some((c) => c.id === expense.costItem!.id)
      ? [...options.costItems, { ...expense.costItem, unit: null, parentId: null, isGroup: false }]
      : options.costItems;
  const supplierList =
    expense.supplier && !suppliers.some((s) => s.id === expense.supplier!.id) ? [...suppliers, expense.supplier] : suppliers;

  return (
    <>
      <PageHeader title="Harcamayı düzenle" />
      <ExpenseForm
        projectId={projectId}
        mode="edit"
        expenseId={expense.id}
        initial={valuesFromExpense(expense)}
        costItems={costItems}
        blocks={options.blocks}
        suppliers={supplierList}
        vatRates={vatRates}
        existingDocuments={expense.documents.map((d) => ({ id: d.id, fileName: d.fileName, mimeType: d.mimeType }))}
        splitLocked={Boolean(expense.splitGroupId)}
        advancedOpen
        canCreateSupplier
      />
    </>
  );
}
