import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Decimal from "decimal.js";
import { CheckCheckIcon, ChevronDownIcon, CircleCheckIcon, HandCoinsIcon, HandshakeIcon, PencilIcon, PlusIcon, TruckIcon } from "lucide-react";
import { InfoTip } from "@/components/info-tip";
import { InfoList } from "@/components/info-list";
import { PageHeader } from "@/components/page-header";
import { ApprovalBadge } from "@/components/expenses/badges";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { hasCapability, ROLE_LABELS } from "@/lib/auth/roles";
import {
  estimatedEndDate,
  permittedFloorArea,
  permittedFootprint,
  totalConstructionArea,
} from "@/lib/calc/zoning";
import { formatDateOnly, formatMoney, formatNumber } from "@/lib/format";
import { LAND_MODEL_LABELS, PROJECT_TYPE_LABELS } from "@/lib/labels";
import { AlertList, Meter } from "@/components/purchasing/shared";
import { projectConnections } from "@/server/connections";
import { budgetTotals } from "@/server/budget";
import { controlSummaries } from "@/server/control";
import { listTotals } from "@/server/pricing";
import { cn } from "@/lib/utils";
import { db } from "@/server/db";
import { salesSummaries } from "@/server/sales";
import { projectSetupSteps } from "@/server/setup";
import { listContracts } from "@/server/contracts";
import { projectExpenseOverview } from "@/server/expenses";
import { getProject, listProjectTeam } from "@/server/projects";
import { getCashFlow } from "@/server/cashflow";
import { listPayables } from "@/server/reports";
import { isAdvancedView } from "@/server/view-mode";
import { monthLabel } from "@/lib/cashflow/cashflow";

export const metadata: Metadata = { title: "Proje paneli" };

export default async function ProjectPanelPage({ params }: PageProps<"/projects/[projectId]">) {
  const { projectId } = await params;
  const { project, role } = await getProject(projectId);
  if (!project) notFound();

  const canEdit = hasCapability(role, "project.edit");
  const canEnter = hasCapability(role, "expense.create");
  const canSeeBudget = hasCapability(role, "budget.view");
  const [overview, connections, contracts, budgets] = await Promise.all([
    projectExpenseOverview(projectId),
    projectConnections(projectId),
    hasCapability(role, "contract.view") ? listContracts(projectId) : null,
    canSeeBudget ? budgetTotals([projectId]) : null,
  ]);
  const control = canSeeBudget ? (await controlSummaries([projectId])).get(projectId) : undefined;
  const priceList = hasCapability(role, "priceList.view") ? (await listTotals([projectId])).get(projectId) : undefined;
  const sales = hasCapability(role, "sales.view") ? (await salesSummaries([projectId])).get(projectId) : undefined;
  const team = hasCapability(role, "project.viewTeam") ? await listProjectTeam(projectId) : null;
  const setup = await projectSetupSteps(projectId, role);
  const cash = hasCapability(role, "cashflow.view") ? await getCashFlow(projectId).catch(() => null) : null;
  const payables = hasCapability(role, "expense.viewAll") ? await listPayables({ projectId }).catch(() => null) : null;
  const dueRows = payables?.filter((r) => r.bucket === "overdue" || r.bucket === "thisWeek") ?? [];
  const dueSoon = payables
    ? { count: dueRows.length, overdue: dueRows.filter((r) => r.bucket === "overdue").length, total: dueRows.reduce((sum, r) => sum.plus(r.totalTry), new Decimal(0)) }
    : null;
  const advanced = await isAdvancedView();
  const setupLeft = setup?.filter((s) => !s.done) ?? [];
  const pendingApprovals = hasCapability(role, "expense.approve") ? await db.expense.count({ where: { projectId, deletedAt: null, approvalStatus: "PENDING" } }) : 0;
  const quick = [
    canEnter && { href: `/projects/${project.id}/expenses/new`, label: "Harcama gir", icon: PlusIcon, primary: true },
    canEnter && { href: `/projects/${project.id}/expenses/delivery`, label: "Malzeme geldi", icon: TruckIcon },
    pendingApprovals > 0 && { href: `/projects/${project.id}/expenses?status=PENDING`, label: `Onay bekleyen (${pendingApprovals})`, icon: CheckCheckIcon },
    hasCapability(role, "sales.manage") && { href: `/projects/${project.id}/sales/new`, label: "Satış yap", icon: HandshakeIcon },
    hasCapability(role, "collection.manage") && sales && sales.sold > 0 && { href: `/projects/${project.id}/collections`, label: "Tahsilat gir", icon: HandCoinsIcon },
  ].filter((q): q is { href: string; label: string; icon: typeof PlusIcon; primary?: boolean } => Boolean(q));
  const totalArea = totalConstructionArea(project.blocks);
  const floorArea = permittedFloorArea(project.landArea, project.floorAreaRatio);
  const footprint = permittedFootprint(project.landArea, project.groundCoverageRatio);
  const endDate = estimatedEndDate(project.startDate, project.durationMonths);

  return (
    <>
      <PageHeader
        title={project.name}
        description={`${PROJECT_TYPE_LABELS[project.type]} · ${LAND_MODEL_LABELS[project.landModel]}`}
        actions={
          canEdit && (
            <Button asChild variant="outline">
              <Link href={`/projects/${project.id}/edit`}>
                <PencilIcon />
                Bilgileri düzenle
              </Link>
            </Button>
          )
        }
      >
        <StatusBadge status={project.status} className="mt-2" />
      </PageHeader>

      <div className="grid grid-cols-1 gap-4">
        {quick.length > 0 && (
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
            {quick.map((q) => (
              <Button key={q.href} asChild size="lg" variant={q.primary ? "default" : "outline"} className="h-12 justify-start sm:justify-center">
                <Link href={q.href}>
                  <q.icon />
                  {q.label}
                </Link>
              </Button>
            ))}
          </div>
        )}
        {setup && setupLeft.length > 0 && (
          <Card className="gap-3 border-sky-200 bg-sky-50/50">
            <CardHeader>
              <CardTitle>
                Proje kurulumu: {setup.length - setupLeft.length} / {setup.length} adım tamam
              </CardTitle>
              <CardDescription>Sıradaki adımlar. Hepsi tamamlanınca bu kutu kendiliğinden kalkar.</CardDescription>
            </CardHeader>
            <CardContent>
              <ol className="grid grid-cols-1 gap-1.5 text-sm sm:grid-cols-2">
                {setup.map((step, i) => (
                  <li key={step.key}>
                    <Link href={step.href} className={cn("flex items-start gap-2 rounded-md p-1.5 hover:bg-white", step.done && "text-muted-foreground")}>
                      {step.done ? <CircleCheckIcon className="mt-0.5 size-4 shrink-0 text-emerald-600" /> : <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border border-sky-400 text-[10px] font-semibold text-sky-700">{i + 1}</span>}
                      <span>
                        <span className={cn("block font-medium", step.done && "line-through")}>{step.label}</span>
                        {!step.done && <span className="block text-xs text-muted-foreground">{step.hint}</span>}
                      </span>
                    </Link>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        )}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {overview && !overview.ownOnly && (
            <Question
              q="Ne harcadık?"
              term="Harcamalar"
              href={`/projects/${project.id}/expenses`}
              value={formatMoney(overview.net)}
              note={overview.pending ? `${overview.pending} kayıt onay bekliyor · KDV hariç` : "Onaylı harcamalar, KDV hariç"}
              tone={overview.pending ? "warn" : undefined}
            />
          )}
          {canSeeBudget && (
            <Question
              q="Bütçe ne durumda?"
              term="Tahmini toplam maliyet"
              href={`/projects/${project.id}/control`}
              value={control && budgets?.get(projectId) ? formatMoney(control.eac) : "Bütçe yok"}
              note={
                control && budgets?.get(projectId)
                  ? `Tahmini toplam maliyet · bütçe ${formatMoney(budgets.get(projectId) ?? 0)} · ${control.variance.isNegative() ? `${formatMoney(control.variance.abs())} aşım bekleniyor` : "bütçe içinde"}${control.progress ? ` · %${formatNumber(control.progress, 0)} tamamlandı` : ""}`
                  : "Bütçe sekmesinden ekleyin"
              }
              tone={control?.variance.isNegative() ? "danger" : undefined}
            />
          )}
          {sales && (
            <Question
              q="Ne sattık?"
              term="Satışlar"
              href={`/projects/${project.id}/sales`}
              value={`${sales.sold} / ${sales.contractorUnits} bölüm`}
              note={`Tahsil edilen ${formatMoney(sales.collectedTry)} · kalan alacak ${formatMoney(sales.remainingTry)}${sales.overdueCount ? ` · ${sales.overdueCount} taksit gecikmiş` : ""}${priceList && !priceList.priced ? " · onaylı fiyat listesi yok" : ""}`}
              tone={sales.overdueCount ? "danger" : undefined}
            />
          )}
          {cash && (
            <Question
              q="Kasada ne var, ne lazım?"
              term="En yüksek nakit ihtiyacı"
              href={`/projects/${project.id}/cash-flow`}
              value={cash.outcome.peakNeed.gt(0) ? formatMoney(cash.outcome.peakNeed) : formatMoney(cash.flow.endBalance)}
              note={
                cash.outcome.peakNeed.gt(0)
                  ? `Dışarıdan gereken en yüksek tutar · ${monthLabel(cash.outcome.peakMonth)} · tahmin`
                  : "Proje sonunda kasada kalacak (tahmin); kasa hiç eksiye düşmüyor"
              }
              tone={cash.outcome.peakNeed.gt(0) ? "warn" : undefined}
            />
          )}
          {dueSoon && (
            <Question
              q="Bu hafta ne ödenecek?"
              term="Vade listesi"
              href={`/company/payables?proje=${project.id}`}
              value={formatMoney(dueSoon.total)}
              note={dueSoon.count ? `${dueSoon.count} ödeme${dueSoon.overdue ? ` · ${dueSoon.overdue} tanesinin vadesi geçti` : ""} · KDV dahil` : "Bu hafta ödeme yok"}
              tone={dueSoon.overdue ? "danger" : undefined}
            />
          )}
        </div>

        {overview && (
          <Card>
            <CardHeader>
              <CardTitle>{overview.ownOnly ? "Son girişlerim" : "Son harcamalar"}</CardTitle>
              {!overview.ownOnly && (
                <CardDescription>Ödenmemiş (KDV dahil): {formatMoney(overview.unpaid)}</CardDescription>
              )}
              <CardAction className="flex gap-2">
                <Button asChild size="sm" variant="ghost">
                  <Link href={`/projects/${project.id}/expenses`}>Tümü</Link>
                </Button>
              </CardAction>
            </CardHeader>
            <CardContent>
              {overview.recent.length === 0 ? (
                <p className="text-sm text-muted-foreground">Henüz harcama girilmemiş.</p>
              ) : (
                <ul className="grid grid-cols-1 gap-2 text-sm">
                  {overview.recent.map((e) => (
                    <li key={e.id} className="flex flex-wrap items-center justify-between gap-2">
                      <Link href={`/projects/${project.id}/expenses/${e.id}`} className="min-w-0 truncate hover:underline">
                        {formatDateOnly(e.date)} · {e.costItem ? `${e.costItem.code} ${e.costItem.name}` : "Avans"}
                        {e.supplier && <span className="text-muted-foreground"> · {e.supplier.name}</span>}
                      </Link>
                      <span className="flex items-center gap-2">
                        <ApprovalBadge status={e.approvalStatus} />
                        <span className="tabular-nums">{formatMoney(e.totalAmountTry)}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        )}

        {connections && connections.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Projeye bağlı bağlantılar</CardTitle>
              <CardDescription>Bu projeye tahsis edilen ve çekilen malzeme</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              {connections.map((c) => (
                <div key={c.id} className="grid gap-1.5 text-sm">
                  <Link href={`/company/connections/${c.id}`} className="font-medium hover:underline">
                    {c.no} · {c.supplier}
                  </Link>
                  {c.items.map((item) => (
                    <div key={item.id} className="grid gap-1">
                      <span className="flex flex-wrap justify-between gap-2 text-xs">
                        <span>{item.description}</span>
                        <span className="tabular-nums text-muted-foreground">
                          {formatNumber(item.drawn, 2)} / {formatNumber(item.allocated, 2)} {item.unit} · kalan {formatNumber(item.remaining, 2)}
                        </span>
                      </span>
                      <Meter value={item.allocated.isZero() ? 0 : item.drawn.div(item.allocated).times(100).toNumber()} />
                    </div>
                  ))}
                  <AlertList alerts={c.alerts} />
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {contracts && contracts.rows.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Taşeronlar</CardTitle>
              <CardAction>
                <Button asChild size="sm" variant="ghost">
                  <Link href={`/projects/${project.id}/contracts`}>Tümü</Link>
                </Button>
              </CardAction>
            </CardHeader>
            <CardContent>
              <ul className="grid grid-cols-1 gap-2 text-sm">
                {contracts.rows.filter((c) => c.status === "ACTIVE").slice(0, 6).map((c) => (
                  <li key={c.id} className="grid gap-1">
                    <span className="flex flex-wrap justify-between gap-2">
                      <Link href={`/projects/${project.id}/contracts/${c.id}`} className="min-w-0 truncate hover:underline">
                        {c.title} · {c.supplier.name}
                      </Link>
                      <span className="text-xs text-muted-foreground tabular-nums">
                        %{formatNumber(c.percent, 1)}
                        {c.openBilling && ` · ${c.openBilling.seq}. hakediş bekliyor`}
                      </span>
                    </span>
                    <Meter value={c.percent.toNumber()} />
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        <details open={advanced} className="group grid gap-4 [&[open]>summary_svg]:rotate-180">
          <summary className="flex cursor-pointer list-none items-center gap-2 rounded-lg border bg-card px-4 py-3 text-sm font-medium hover:bg-accent [&::-webkit-details-marker]:hidden">
            Proje bilgileri, bloklar ve ekip
            <ChevronDownIcon className="size-4 text-muted-foreground transition-transform" aria-hidden />
          </summary>
          <div className="mt-4 grid grid-cols-1 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Proje bilgileri</CardTitle>
          </CardHeader>
          <CardContent>
            <InfoList
              items={[
                { label: "Adres", value: project.address },
                {
                  label: "Ada / parsel",
                  value:
                    project.landBlockNo || project.landParcelNo
                      ? `${project.landBlockNo ?? "—"} / ${project.landParcelNo ?? "—"}`
                      : null,
                },
                {
                  label: "Arsa alanı",
                  value: project.landArea ? `${formatNumber(project.landArea)} m²` : null,
                },
                { label: "Emsal (KAKS)", value: project.floorAreaRatio ? formatNumber(project.floorAreaRatio, 4) : null },
                {
                  label: "TAKS",
                  value: project.groundCoverageRatio ? formatNumber(project.groundCoverageRatio, 4) : null,
                },
                {
                  label: "Emsal alanı",
                  value: floorArea ? `${formatNumber(floorArea)} m²` : null,
                  hint: "Arsa alanı × emsal",
                },
                {
                  label: "Taban oturumu",
                  value: footprint ? `${formatNumber(footprint)} m²` : null,
                  hint: "Arsa alanı × TAKS",
                },
                { label: "Başlangıç", value: project.startDate ? formatDateOnly(project.startDate) : null },
                {
                  label: "Süre / tahmini bitiş",
                  value: project.durationMonths
                    ? `${project.durationMonths} ay${endDate ? ` · ${formatDateOnly(endDate)}` : ""}`
                    : null,
                },
              ]}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Bloklar</CardTitle>
            <CardDescription>
              {project.blocks.length} blok
              {totalArea.gt(0) && ` · toplam ${formatNumber(totalArea)} m² inşaat alanı`}
            </CardDescription>
            <CardAction>
              <Button asChild size="sm" variant="ghost">
                <Link href={`/projects/${project.id}/blocks`}>Bloklar ekranı</Link>
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent className="px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-5">Blok</TableHead>
                  <TableHead className="text-right">Kat</TableHead>
                  <TableHead className="text-right">Bodrum</TableHead>
                  <TableHead className="pr-5 text-right">İnşaat alanı</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {project.blocks.map((block) => (
                  <TableRow key={block.id}>
                    <TableCell className="pl-5 font-medium">{block.name}</TableCell>
                    <TableCell className="text-right tabular-nums">{block.floorCount ?? "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{block.basementCount ?? "—"}</TableCell>
                    <TableCell className="pr-5 text-right tabular-nums">
                      {block.constructionArea ? `${formatNumber(block.constructionArea)} m²` : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {team && (
          <Card>
            <CardHeader>
              <CardTitle>Ekip</CardTitle>
              <CardDescription>
                Bu projeye yetkili kullanıcılar. Yöneticiler tüm projeleri görür.
              </CardDescription>
              <CardAction>
                <Button asChild size="sm" variant="ghost">
                  <Link href="/settings/users">Kullanıcılar</Link>
                </Button>
              </CardAction>
            </CardHeader>
            <CardContent>
              {team.length === 0 ? (
                <p className="text-sm text-muted-foreground">Henüz projeye özel yetki verilmedi.</p>
              ) : (
                <ul className="grid grid-cols-1 gap-2 text-sm">
                  {team.map((member) => (
                    <li key={member.user.id} className="flex flex-wrap justify-between gap-2">
                      <span className="font-medium">{member.user.name}</span>
                      <span className="text-muted-foreground">{ROLE_LABELS[member.role]}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        )}
          </div>
        </details>
      </div>
    </>
  );
}

/** Panelde bir soru ve cevabı (kartın tamamı ilgili ekrana gider). */
function Question({ q, term, href, value, note, tone }: { q: string; term: string; href: string; value: string; note: string; tone?: "warn" | "danger" }) {
  return (
    <Link href={href} className="group grid gap-1 rounded-xl border bg-card p-4 shadow-sm transition-colors hover:border-primary/40 hover:bg-primary/5">
      <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
        {q}
        <InfoTip term={term} />
      </span>
      <span className={cn("text-xl font-semibold tabular-nums", tone === "warn" && "text-amber-700", tone === "danger" && "text-destructive")}>{value}</span>
      <span className="text-xs text-muted-foreground">{note}</span>
    </Link>
  );
}
