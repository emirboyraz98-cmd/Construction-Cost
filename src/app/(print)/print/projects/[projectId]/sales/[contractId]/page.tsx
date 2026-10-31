import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PrintSheet, Signatures } from "@/components/print-sheet";
import { FLOOR_LABEL, USAGE_TYPE_LABELS } from "@/lib/budget/labels";
import { PAYMENT_METHOD_LABELS } from "@/lib/expenses/labels";
import { formatDateOnly, formatMoney, formatNumber } from "@/lib/format";
import { INSTALLMENT_KIND_LABELS, INSTALLMENT_STATE_LABELS } from "@/lib/sales/labels";
import { db } from "@/server/db";
import { getContract } from "@/server/sales";

export const metadata: Metadata = { title: "Ödeme planı" };

/** Müşteriye verilecek satış özeti ve ödeme planı (yazdır / PDF). */
export default async function ContractPrintPage({ params }: PageProps<"/print/projects/[projectId]/sales/[contractId]">) {
  const { projectId, contractId } = await params;
  const data = await getContract(projectId, contractId);
  if (!data) notFound();
  const { contract: c, state } = data;
  const project = await db.project.findUnique({ where: { id: projectId }, select: { name: true, address: true } });
  const cur = c.currency;
  const u = c.unit;
  return (
    <PrintSheet title={`Satış özeti ve ödeme planı – ${u.block.name} No ${u.doorNo}`} subtitle={`${project?.name ?? ""}${project?.address ? ` · ${project.address}` : ""} · sözleşme ${formatDateOnly(c.date)}${c.contractNo ? ` · No ${c.contractNo}` : ""}`}>
      <div className="grid gap-4 sm:grid-cols-2 print:grid-cols-2">
        <section>
          <h2 className="mb-1 font-semibold">Alıcı</h2>
          <p>{c.customer.name}</p>
          {c.customer.identityNo && <p>T.C. / VKN: {c.customer.identityNo}</p>}
          {c.customer.phone && <p>Tel: {c.customer.phone}</p>}
          {c.customer.address && <p>{c.customer.address}</p>}
        </section>
        <section>
          <h2 className="mb-1 font-semibold">Bağımsız bölüm</h2>
          <p>
            {u.block.name} · {FLOOR_LABEL(u.floor)} · No {u.doorNo}
          </p>
          <p>{[USAGE_TYPE_LABELS[u.usageType], u.layout].filter(Boolean).join(" · ")}</p>
          <p>
            Net {formatNumber(u.netArea, 2)} m² · brüt {formatNumber(u.grossArea, 2)} m²
          </p>
        </section>
      </div>
      <dl className="mt-4 grid max-w-sm grid-cols-[1fr_auto] gap-x-4 gap-y-1 tabular-nums">
        <dt>Liste fiyatı</dt>
        <dd className="text-right">{formatMoney(c.listPrice, cur)}</dd>
        {Number(c.discount) > 0 && (
          <>
            <dt>İndirim</dt>
            <dd className="text-right">− {formatMoney(c.discount, cur)}</dd>
          </>
        )}
        <dt>Satış fiyatı (KDV hariç)</dt>
        <dd className="text-right">{formatMoney(c.salePrice, cur)}</dd>
        <dt>KDV (%{formatNumber(c.vatRate, 2)})</dt>
        <dd className="text-right">{formatMoney(c.vatAmount, cur)}</dd>
        <dt className="border-t border-black pt-1 font-semibold">Toplam (KDV dahil)</dt>
        <dd className="border-t border-black pt-1 text-right font-semibold">{formatMoney(c.totalAmount, cur)}</dd>
      </dl>
      <h2 className="mt-5 mb-1 font-semibold">Ödeme planı</h2>
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-black text-left">
            <th className="py-1 pr-2">#</th>
            <th className="py-1 pr-2">Vade</th>
            <th className="py-1 pr-2">Tür</th>
            <th className="py-1 pr-2 text-right">Tutar</th>
            <th className="py-1 pr-2 text-right">Ödenen</th>
            <th className="py-1 pr-2 text-right">Kalan</th>
            <th className="py-1">Durum</th>
          </tr>
        </thead>
        <tbody>
          {state.rows.map((r, i) => (
            <tr key={r.id} className="border-b border-neutral-300 break-inside-avoid">
              <td className="py-1 pr-2">{i + 1}</td>
              <td className="py-1 pr-2 tabular-nums">{formatDateOnly(r.dueDate)}</td>
              <td className="py-1 pr-2">{INSTALLMENT_KIND_LABELS[r.kind]}</td>
              <td className="py-1 pr-2 text-right tabular-nums">{formatMoney(r.amount, cur)}</td>
              <td className="py-1 pr-2 text-right tabular-nums">{r.paid.gt(0) ? formatMoney(r.paid, cur) : "—"}</td>
              <td className="py-1 pr-2 text-right tabular-nums">{r.remaining.gt(0) ? formatMoney(r.remaining, cur) : "—"}</td>
              <td className="py-1">{INSTALLMENT_STATE_LABELS[r.state]}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-black font-semibold">
            <td className="py-1" colSpan={3}>
              Toplam
            </td>
            <td className="py-1 pr-2 text-right tabular-nums">{formatMoney(state.total, cur)}</td>
            <td className="py-1 pr-2 text-right tabular-nums">{formatMoney(state.collected, cur)}</td>
            <td className="py-1 pr-2 text-right tabular-nums">{formatMoney(state.remaining, cur)}</td>
            <td />
          </tr>
        </tfoot>
      </table>
      {c.collections.length > 0 && (
        <>
          <h2 className="mt-5 mb-1 font-semibold">Yapılan ödemeler</h2>
          <ul className="grid gap-0.5">
            {[...c.collections].reverse().map((x) => (
              <li key={x.id} className="tabular-nums">
                {formatDateOnly(x.date)} · {PAYMENT_METHOD_LABELS[x.method]}
                {x.documentNo ? ` No ${x.documentNo}` : ""} · {formatMoney(x.amount, cur)}
                {x.chequeStatus === "PENDING" ? " (çek / senet, tahsil edilmedi)" : x.chequeStatus === "BOUNCED" ? " (karşılıksız)" : ""}
              </li>
            ))}
          </ul>
        </>
      )}
      <p className="mt-4 text-[10px] text-neutral-500">Bu belge bilgilendirme amaçlıdır; satış sözleşmesinin yerine geçmez. Düzenlenme: {formatDateOnly(new Date())}.</p>
      <Signatures labels={["Satıcı", "Alıcı"]} />
    </PrintSheet>
  );
}
