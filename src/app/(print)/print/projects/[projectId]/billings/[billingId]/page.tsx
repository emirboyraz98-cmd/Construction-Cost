import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Decimal from "decimal.js";
import { PrintSheet, Signatures } from "@/components/print-sheet";
import { formatDateOnly, formatMoney, formatNumber } from "@/lib/format";
import { getBilling } from "@/server/contracts";
import { db } from "@/server/db";

export const metadata: Metadata = { title: "Hakediş" };

/** Yazdırılabilir hakediş (taşerona verilecek / dosyaya konacak). */
export default async function BillingPrintPage({ params }: PageProps<"/print/projects/[projectId]/billings/[billingId]">) {
  const { projectId, billingId } = await params;
  const detail = await getBilling(projectId, billingId);
  if (!detail) notFound();
  const b = detail.billing;
  const project = await db.project.findUnique({ where: { id: projectId }, select: { name: true } });
  const money = (v: { toString(): string } | null) => (v == null ? "—" : formatMoney(v));
  const period = [b.periodStart && formatDateOnly(b.periodStart), b.periodEnd && formatDateOnly(b.periodEnd)].filter(Boolean).join(" – ");
  return (
    <PrintSheet title={`${b.seq}. Hakediş – ${b.contract.no} ${b.contract.title}`} subtitle={`${project?.name ?? ""} · ${b.contract.supplier.name}${b.contract.supplier.taxNumber ? ` (VKN ${b.contract.supplier.taxNumber})` : ""} · hakediş tarihi ${formatDateOnly(b.date)}${period ? ` · dönem ${period}` : ""}`}>
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-black text-left">
            <th className="py-1 pr-2">İş kalemi</th>
            <th className="py-1 pr-2 text-right">Birim fiyat</th>
            <th className="py-1 pr-2 text-right">Önceki</th>
            <th className="py-1 pr-2 text-right">Kümülatif</th>
            <th className="py-1 pr-2 text-right">Bu dönem</th>
            <th className="py-1 text-right">Tutar</th>
          </tr>
        </thead>
        <tbody>
          {b.lines.map((l) => (
            <tr key={l.id} className="border-b border-neutral-300 break-inside-avoid">
              <td className="py-1 pr-2">
                {l.contractItem.description}
                <span className="block text-[10px] text-neutral-500">
                  {l.contractItem.costItem.code} {l.contractItem.costItem.name}
                </span>
              </td>
              <td className="py-1 pr-2 text-right tabular-nums">{l.contractItem.unitPrice ? `${formatMoney(l.contractItem.unitPrice)} / ${l.contractItem.unit}` : "—"}</td>
              <td className="py-1 pr-2 text-right tabular-nums">{formatNumber(l.previousQuantity, 4)}</td>
              <td className="py-1 pr-2 text-right tabular-nums">{formatNumber(l.cumulativeQuantity, 4)}</td>
              <td className="py-1 pr-2 text-right tabular-nums">
                {formatNumber(new Decimal(l.cumulativeQuantity.toString()).minus(l.previousQuantity.toString()), 4)} {l.contractItem.unit}
              </td>
              <td className="py-1 text-right tabular-nums">{money(l.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {detail.perms.amounts && (
        <dl className="mt-4 ml-auto grid max-w-sm grid-cols-[1fr_auto] gap-x-4 gap-y-1 tabular-nums break-inside-avoid">
          <dt>Bu dönem brüt (KDV hariç)</dt>
          <dd className="text-right font-medium">{money(b.grossAmount)}</dd>
          <dt>+ KDV (%{formatNumber(b.vatRate)})</dt>
          <dd className="text-right">{money(b.vatAmount)}</dd>
          <dt>− KDV tevkifatı</dt>
          <dd className="text-right">{money(b.vatWithheld)}</dd>
          <dt>− Teminat</dt>
          <dd className="text-right">{money(b.retention)}</dd>
          <dt>− Avans mahsubu</dt>
          <dd className="text-right">{money(b.advanceOffset)}</dd>
          <dt>− Malzeme mahsubu</dt>
          <dd className="text-right">{money(b.materialOffset)}</dd>
          <dt>− Diğer{b.otherDeductionNote ? ` (${b.otherDeductionNote})` : ""}</dt>
          <dd className="text-right">{money(b.otherDeductions)}</dd>
          <dt className="border-t border-black pt-1 font-semibold">Net ödenecek</dt>
          <dd className="border-t border-black pt-1 text-right text-sm font-semibold">{money(b.payableAmount)}</dd>
        </dl>
      )}
      {b.notes && <p className="mt-3 text-neutral-700">Not: {b.notes}</p>}
      <p className="mt-3 text-neutral-600">
        Durum: {b.status === "APPROVED" ? `Onaylı${b.approvedBy ? ` (${b.approvedBy.name}${b.approvedAt ? `, ${formatDateOnly(b.approvedAt)}` : ""})` : ""}` : b.status === "PENDING" ? "Onay bekliyor" : "Taslak"} · Hazırlayan: {b.createdBy.name}
      </p>
      <Signatures labels={["Hazırlayan", "Kontrol eden", "Onaylayan", "Taşeron"]} />
    </PrintSheet>
  );
}
