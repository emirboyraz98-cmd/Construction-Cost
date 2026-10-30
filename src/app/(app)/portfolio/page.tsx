import type { Metadata } from "next";
import Link from "next/link";
import { PlusIcon } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { PendingFigure, ProjectCard, SpendFigure } from "@/components/project-card";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { projectRole } from "@/lib/auth/access";
import { hasCapability } from "@/lib/auth/roles";
import { totalConstructionArea } from "@/lib/calc/zoning";
import { DUE_BUCKET_LABELS } from "@/lib/expenses/payables";
import { Decimal, formatDateOnly, formatMoney, formatNumber } from "@/lib/format";
import { PROJECT_STATUS_ORDER } from "@/lib/labels";
import { getAccess } from "@/server/access";
import { listProjects } from "@/server/projects";
import { AlertList } from "@/components/purchasing/shared";
import { connectionAlertOverview } from "@/server/connections";
import { listPayables, spendSummaries } from "@/server/reports";

export const metadata: Metadata = { title: "Portföy" };

export default async function PortfolioPage() {
  const { user, scope } = await getAccess();
  const canSeeSpend = hasCapability(user.role, "expense.viewAll");
  const [projects, spend, payables, connectionAlerts] = await Promise.all([
    listProjects({ statuses: PROJECT_STATUS_ORDER.filter((status) => status !== "ARCHIVED") }),
    canSeeSpend ? spendSummaries() : null,
    canSeeSpend ? listPayables() : null,
    connectionAlertOverview(),
  ]);
  const canCreate = hasCapability(user.role, "project.create");
  const blockCount = projects.reduce((sum, project) => sum + project._count.blocks, 0);
  const area = totalConstructionArea(projects.flatMap((project) => project.blocks));

  const visible = projects.filter((p) => hasCapability(projectRole(scope, p.id), "expense.viewAll"));
  const totals = visible.reduce(
    (acc, p) => {
      const s = spend?.summaries.get(p.id);
      return {
        net: acc.net.plus(s?.net ?? 0),
        pending: acc.pending + (s?.pending ?? 0),
        unpaid: acc.unpaid.plus(s?.unpaid ?? 0),
      };
    },
    { net: new Decimal(0), pending: 0, unpaid: new Decimal(0) },
  );
  const soon = (payables ?? []).filter((r) => r.bucket === "overdue" || r.bucket === "thisWeek");
  const soonTotal = soon.reduce((s, r) => s.plus(r.totalTry), new Decimal(0));

  return (
    <>
      <PageHeader
        title="Portföy"
        description="Yürüyen tüm projelerin özeti. Arşivdeki projeler Projeler listesinde."
        actions={
          canCreate && (
            <Button asChild>
              <Link href="/projects/new">
                <PlusIcon />
                Yeni proje
              </Link>
            </Button>
          )
        }
      />

      <Card className="mb-6 py-4">
        <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          <div>
            <p className="text-xs text-muted-foreground">Aktif proje</p>
            <p className="text-lg font-semibold tabular-nums">{projects.length}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Blok · inşaat alanı</p>
            <p className="text-lg font-semibold tabular-nums">
              {blockCount} · {formatNumber(area, 0)} m²
            </p>
          </div>
          <PendingFigure label="Toplam bütçe" phase={3} />
          {canSeeSpend ? (
            <>
              <SpendFigure label="Toplam harcanan (KDV hariç)" value={totals.net} note="Onaylı kayıtlar" />
              <SpendFigure label="Ödenmemiş (KDV dahil)" value={totals.unpaid} />
              <div>
                <p className="text-xs text-muted-foreground">Onay bekleyen</p>
                <p className="text-lg font-semibold tabular-nums">{totals.pending}</p>
              </div>
            </>
          ) : (
            <PendingFigure label="Tahsilat" phase={6} />
          )}
        </CardContent>
      </Card>

      {canSeeSpend && soon.length > 0 && (
        <Card className="mb-6 gap-2">
          <CardHeader>
            <CardTitle>Bu hafta ödenecekler</CardTitle>
            <CardAction>
              <Button asChild variant="ghost" size="sm">
                <Link href="/company/payables">Vade listesi</Link>
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent>
            <p className="mb-2 text-sm">
              {soon.length} kayıt · <strong className="tabular-nums">{formatMoney(soonTotal)}</strong>
            </p>
            <ul className="grid gap-1.5 text-sm">
              {soon.slice(0, 6).map((row) => (
                <li key={row.key} className="flex flex-wrap justify-between gap-2">
                  <Link href={row.href} className="min-w-0 truncate hover:underline">
                    <span className={row.bucket === "overdue" ? "text-destructive" : ""}>
                      {row.dueDate ? formatDateOnly(row.dueDate) : "—"}
                    </span>{" "}
                    · {row.supplier ?? "Tedarikçi yok"} · {row.project}
                  </Link>
                  <span className="tabular-nums">{formatMoney(row.totalTry)}</span>
                </li>
              ))}
            </ul>
            {soon.some((r) => r.bucket === "overdue") && (
              <p className="mt-2 text-xs text-destructive">Kırmızı tarihler: {DUE_BUCKET_LABELS.overdue.toLocaleLowerCase("tr-TR")}.</p>
            )}
          </CardContent>
        </Card>
      )}

      {connectionAlerts && connectionAlerts.length > 0 && (
        <Card className="mb-6 gap-2">
          <CardHeader>
            <CardTitle>Bağlantı uyarıları</CardTitle>
            <CardAction>
              <Button asChild variant="ghost" size="sm">
                <Link href="/company/connections">Bağlantılar</Link>
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent>
            <ul className="grid gap-3 text-sm">
              {connectionAlerts.slice(0, 6).map((c) => (
                <li key={c.id}>
                  <Link href={`/company/connections/${c.id}`} className="font-medium hover:underline">
                    {c.no} · {c.supplier}
                  </Link>
                  <AlertList alerts={c.alerts} className="mt-1" />
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {projects.length === 0 ? (
        <Card>
          <CardContent className="py-6 text-center text-sm text-muted-foreground">
            {canCreate
              ? "Henüz proje yok. “Yeni proje” ile ilk projenizi oluşturun."
              : "Size henüz bir proje atanmadı. Yöneticinizden proje yetkisi isteyin."}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {projects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              spend={
                hasCapability(projectRole(scope, project.id), "expense.viewAll")
                  ? (spend?.summaries.get(project.id) ?? null)
                  : undefined
              }
            />
          ))}
        </div>
      )}
    </>
  );
}
