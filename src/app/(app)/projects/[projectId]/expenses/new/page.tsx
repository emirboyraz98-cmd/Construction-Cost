import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { ExpenseForm } from "@/components/expenses/expense-form";
import { emptyExpenseValues, valuesFromExpense } from "@/components/expenses/form-values";
import { Card, CardContent } from "@/components/ui/card";
import { hasCapability } from "@/lib/auth/roles";
import { db } from "@/server/db";
import { entryOptions, getExpense } from "@/server/expenses";
import { vatRateOptions } from "@/server/parameters";
import { requireProjectAccess } from "@/server/access";
import { supplierOptions } from "@/server/suppliers";

export const metadata: Metadata = { title: "Harcama gir" };

export default async function NewExpensePage({ params, searchParams }: PageProps<"/projects/[projectId]/expenses/new">) {
  const { projectId } = await params;
  const { copy } = await searchParams;
  const { role, user } = await requireProjectAccess(projectId);
  if (!hasCapability(role, "expense.create")) {
    return (
      <>
        <PageHeader title="Harcama gir" />
        <Card className="max-w-xl">
          <CardContent className="text-sm text-muted-foreground">Bu projede harcama girme yetkiniz yok.</CardContent>
        </Card>
      </>
    );
  }

  const today = new Date();
  const [options, suppliers, vatRates, project] = await Promise.all([
    entryOptions(projectId),
    supplierOptions(),
    vatRateOptions(today.getUTCFullYear()),
    db.project.findUnique({ where: { id: projectId }, select: { name: true } }),
  ]);
  if (!project) notFound();

  // "Benzerini gir": kalem, tedarikçi, tutar ve ödeme bilgisi kopyalanır; tarih bugün, belge no boş.
  const source = typeof copy === "string" ? await getExpense(projectId, copy) : null;
  const initial = source
    ? { ...valuesFromExpense(source.expense), date: emptyExpenseValues(today, "").date, documentNo: "", paidAt: "", dueDate: "" }
    : emptyExpenseValues(today, vatRates[0]?.value ?? "20");

  return (
    <>
      <PageHeader
        title="Harcama gir"
        description={
          <>
            {project.name} · Fişin fotoğrafını çekin, kalemi seçin, tutarı yazın.{" "}
            <Link href={`/projects/${projectId}/expenses/batch`} className="underline">
              Çok sayıda fatura için toplu giriş
            </Link>
          </>
        }
      />
      <ExpenseForm
        projectId={projectId}
        mode="create"
        initial={initial}
        costItems={options.costItems}
        blocks={options.blocks}
        suppliers={suppliers}
        vatRates={vatRates}
        advancedOpen={hasCapability(role, "expense.manage")}
        canCreateSupplier
        offline={{ owner: user.email, projectName: project.name }}
      />
    </>
  );
}
