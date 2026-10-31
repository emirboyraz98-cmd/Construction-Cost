import type { Metadata } from "next";
import Link from "next/link";
import { PlusIcon } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { BillingStatusBadge, ContractStatusBadge, Meter, NoAccess } from "@/components/purchasing/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { projectRole } from "@/lib/auth/access";
import { hasCapability } from "@/lib/auth/roles";
import { SUPPLY_METHOD_LABELS } from "@/lib/connections/labels";
import { formatDateOnly, formatMoney, formatNumber } from "@/lib/format";
import { getAccess } from "@/server/access";
import { listContracts } from "@/server/contracts";

export const metadata: Metadata = { title: "Taşeron & hakediş" };

export default async function ContractsPage({ params }: PageProps<"/projects/[projectId]/contracts">) {
  const { projectId } = await params;
  const { scope } = await getAccess();
  if (!hasCapability(projectRole(scope, projectId), "contract.view")) return <NoAccess text="Bu projede taşeron sözleşmelerini görme yetkiniz yok." />;
  const { rows, perms } = await listContracts(projectId);
  return (
    <>
      <PageHeader
        title="Taşeron sözleşmeleri"
        description="Taşeron sözleşmeleri ve her dönem yapılan işin hesabı (hakediş)."
        actions={
          perms.manage && (
            <Button asChild>
              <Link href={`/projects/${projectId}/contracts/new`}>
                <PlusIcon />
                Yeni sözleşme
              </Link>
            </Button>
          )
        }
      />
      {rows.length === 0 ? (
        <Card>
          <CardContent className="py-6 text-center text-sm text-muted-foreground">Bu projede taşeron sözleşmesi yok.</CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {rows.map((c) => (
            <Link key={c.id} href={`/projects/${projectId}/contracts/${c.id}`} className="group rounded-xl outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
              <Card className="h-full py-4 transition-shadow group-hover:shadow-md">
                <CardContent className="grid gap-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-semibold">
                        {c.no} · {c.title}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {c.supplier.name} · {SUPPLY_METHOD_LABELS[c.supplyMethod]} · {formatDateOnly(c.date)}
                      </p>
                    </div>
                    <ContractStatusBadge status={c.status} />
                  </div>
                  <div className="grid gap-1">
                    <span className="flex justify-between text-xs text-muted-foreground">
                      <span>İlerleme (onaylı hakedişler)</span>
                      <span className="tabular-nums">%{formatNumber(c.percent, 1)}</span>
                    </span>
                    <Meter value={c.percent.toNumber()} />
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span>
                      {c.billingCount} onaylı hakediş
                      {c.openBilling && (
                        <span className="ml-2 inline-flex items-center gap-1">
                          · {c.openBilling.seq}. hakediş <BillingStatusBadge status={c.openBilling.status} />
                        </span>
                      )}
                    </span>
                    {"contractAmount" in c && c.contractAmount && (
                      <span className="tabular-nums">
                        {formatMoney(c.doneAmount)} / {formatMoney(c.contractAmount)}
                        {c.unpaid?.gt(0) && <span className="text-amber-700"> · ödenmemiş {formatMoney(c.unpaid)}</span>}
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
