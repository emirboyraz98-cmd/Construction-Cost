import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { NoAccess } from "@/components/purchasing/shared";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { actionLabel, changesText, entityLabel } from "@/lib/audit-labels";
import { hasCapability } from "@/lib/auth/roles";
import { dateInputToDate, formatDateTime } from "@/lib/format";
import { getAccess } from "@/server/access";
import { listAuditLog } from "@/server/admin";

export const metadata: Metadata = { title: "Değişiklik geçmişi" };

const one = (v: string | string[] | undefined) => (typeof v === "string" && v ? v : null);

export default async function HistoryPage({ searchParams }: PageProps<"/settings/history">) {
  const { user } = await getAccess();
  if (!hasCapability(user.role, "audit.view")) return <NoAccess text="Değişiklik geçmişini yalnızca yönetici görür." />;
  const sp = await searchParams;
  const page = Math.max(1, Number(one(sp.sayfa) ?? 1) || 1);
  const filters = { projectId: one(sp.proje), userId: one(sp.kisi), entity: one(sp.kayit), from: dateInputToDate(one(sp.from)), to: dateInputToDate(one(sp.to)), page };
  const data = await listAuditLog(filters);
  const qs = (p: number) => {
    const q = new URLSearchParams(Object.entries({ proje: filters.projectId, kisi: filters.userId, kayit: filters.entity, from: one(sp.from), to: one(sp.to) }).filter((x): x is [string, string] => Boolean(x[1])));
    q.set("sayfa", String(p));
    return `?${q}`;
  };
  return (
    <>
      <PageHeader title="Değişiklik geçmişi" description="Kim, neyi, ne zaman ekledi / değiştirdi / sildi / onayladı. Kayıtlar silinemez ve değiştirilemez." />
      <form className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <NativeSelect name="proje" defaultValue={filters.projectId ?? ""} aria-label="Proje">
          <option value="">Tüm projeler</option>
          {data.projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect name="kisi" defaultValue={filters.userId ?? ""} aria-label="Kişi">
          <option value="">Tüm kişiler</option>
          {data.users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect name="kayit" defaultValue={filters.entity ?? ""} aria-label="Kayıt türü">
          <option value="">Tüm kayıtlar</option>
          {data.entities.map((e) => (
            <option key={e} value={e}>
              {entityLabel(e)}
            </option>
          ))}
        </NativeSelect>
        <Input type="date" name="from" defaultValue={one(sp.from) ?? ""} aria-label="Başlangıç" />
        <Input type="date" name="to" defaultValue={one(sp.to) ?? ""} aria-label="Bitiş" />
        <Button type="submit" variant="outline">
          Filtrele
        </Button>
      </form>
      <Card className="gap-0 overflow-x-auto py-0">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="border-b text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-2 font-medium">Zaman</th>
              <th className="px-2 py-2 font-medium">Kişi</th>
              <th className="px-2 py-2 font-medium">İşlem</th>
              <th className="px-2 py-2 font-medium">Proje</th>
              <th className="px-4 py-2 font-medium">Ayrıntı</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">
                  Kayıt yok.
                </td>
              </tr>
            ) : (
              data.rows.map((r) => (
                <tr key={r.id} className="border-b align-top">
                  <td className="px-4 py-2 whitespace-nowrap tabular-nums">{formatDateTime(r.createdAt)}</td>
                  <td className="px-2 py-2">{r.user?.name ?? "—"}</td>
                  <td className="px-2 py-2">
                    <span className="font-medium">{entityLabel(r.entity)}</span> · {actionLabel(r.action)}
                  </td>
                  <td className="px-2 py-2">{r.project?.name ?? "Şirket geneli"}</td>
                  <td className="max-w-md px-4 py-2 text-xs break-words text-muted-foreground">{changesText(r.changes)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Card>
      <div className="mt-3 flex items-center justify-between text-sm text-muted-foreground">
        <span>
          {data.total} kayıt · sayfa {page} / {data.pages}
        </span>
        <span className="flex gap-2">
          {page > 1 && (
            <Button asChild variant="outline" size="sm">
              <Link href={qs(page - 1)}>Önceki</Link>
            </Button>
          )}
          {page < data.pages && (
            <Button asChild variant="outline" size="sm">
              <Link href={qs(page + 1)}>Sonraki</Link>
            </Button>
          )}
        </span>
      </div>
    </>
  );
}
