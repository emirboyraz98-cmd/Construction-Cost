import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Button } from "@/components/ui/button";
import { hasCapability } from "@/lib/auth/roles";
import { dateToDateInput } from "@/lib/format";
import { cn } from "@/lib/utils";
import { getAccess } from "@/server/access";
import { listProjectSummaries } from "@/server/projects";
import { listPayables } from "@/server/reports";
import { PayablesTable } from "./payables-table";

export const metadata: Metadata = { title: "Vade listesi" };

const VIEWS = { yakin: "Vadesi geçen + bu hafta", tum: "Tüm ödenmemişler" } as const;

export default async function PayablesPage({ searchParams }: PageProps<"/company/payables">) {
  const { user } = await getAccess();
  if (!hasCapability(user.role, "expense.viewAll")) {
    return (
      <Card className="max-w-xl">
        <CardContent className="text-sm text-muted-foreground">Vade listesini görme yetkiniz yok.</CardContent>
      </Card>
    );
  }
  const params = await searchParams;
  const view = params.gorunum === "tum" ? "tum" : "yakin";
  const projectId = typeof params.proje === "string" && params.proje ? params.proje : null;
  const [all, projects] = await Promise.all([listPayables({ projectId }), listProjectSummaries()]);
  const rows = view === "tum" ? all : all.filter((r) => r.bucket === "overdue" || r.bucket === "thisWeek");

  return (
    <>
      <PageHeader title="Vade listesi" description="Ödenmemiş tüm borçlar vade sırasıyla. Ödeyince “Ödendi” işaretleyin." />
      <form className="mb-4 flex flex-wrap items-end gap-3">
        <div className="flex gap-1 rounded-lg bg-muted p-1 text-sm">
          {(Object.keys(VIEWS) as (keyof typeof VIEWS)[]).map((key) => (
            <Link
              key={key}
              href={`?gorunum=${key}${projectId ? `&proje=${projectId}` : ""}`}
              className={cn("rounded-md px-3 py-1.5", view === key ? "bg-background font-medium shadow-sm" : "text-muted-foreground")}
            >
              {VIEWS[key]}
            </Link>
          ))}
        </div>
        <input type="hidden" name="gorunum" value={view} />
        <Label className="font-normal">
          Proje
          <NativeSelect name="proje" defaultValue={projectId ?? ""} className="w-56">
            <option value="">Tüm projeler</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </NativeSelect>
        </Label>
        <Button type="submit" variant="outline">
          Uygula
        </Button>
      </form>
      {rows.length === 0 ? (
        <Card>
          <CardContent className="py-6 text-center text-sm text-muted-foreground">
            {view === "yakin" ? "Vadesi geçen veya bu hafta ödenecek kayıt yok." : "Ödenmemiş kayıt yok."}
          </CardContent>
        </Card>
      ) : (
        <PayablesTable
          today={dateToDateInput(new Date())}
          rows={rows.map((r) => ({
            key: r.key,
            project: r.project,
            dueDate: r.dueDate?.toISOString() ?? null,
            bucket: r.bucket,
            supplier: r.supplier,
            label: r.label,
            documentLabel: r.documentLabel,
            documentNo: r.documentNo,
            total: r.totalTry.toString(),
            pendingApproval: r.pendingApproval,
            canMarkPaid: r.canMarkPaid,
            href: r.href,
          }))}
        />
      )}
    </>
  );
}
