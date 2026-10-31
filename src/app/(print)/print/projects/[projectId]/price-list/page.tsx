import type { Metadata } from "next";
import { FLOOR_LABEL, USAGE_TYPE_LABELS } from "@/lib/budget/labels";
import { formatMoney, formatNumber } from "@/lib/format";
import { ActionError } from "@/server/access";
import { getPriceListExport } from "@/server/pricing";
import { PrintButton } from "./print-button";

export const metadata: Metadata = { title: "Fiyat listesi" };

/** Yazdırılabilir fiyat listesi (tarayıcının "PDF olarak kaydet" seçeneğiyle PDF). */
export default async function PriceListPrintPage({ params, searchParams }: PageProps<"/print/projects/[projectId]/price-list">) {
  const { projectId } = await params;
  const draft = (await searchParams).taslak === "1";
  let data: Awaited<ReturnType<typeof getPriceListExport>>;
  try {
    data = await getPriceListExport(projectId, draft);
  } catch (error) {
    if (error instanceof ActionError) return <p className="p-8 text-sm">{error.message}</p>;
    throw error;
  }
  return (
    <main className="mx-auto max-w-5xl bg-white p-6 text-[12px] text-black print:max-w-none print:p-0">
      <style>{"@page { size: A4 landscape; margin: 12mm; }"}</style>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">{data.projectName} – Bağımsız bölüm fiyat listesi</h1>
          <p className="text-neutral-600">{data.subtitle} · Fiyatlar TL; KDV hariç ve dahil.</p>
        </div>
        <PrintButton />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse">
          <thead>
            <tr className="border-b-2 border-black text-left">
              <th className="py-1 pr-2">Blok</th>
              <th className="py-1 pr-2">Kat</th>
              <th className="py-1 pr-2">No</th>
              <th className="py-1 pr-2">Kullanım / tip</th>
              <th className="py-1 pr-2">Cephe / manzara</th>
              <th className="py-1 pr-2 text-right">Net m²</th>
              <th className="py-1 pr-2 text-right">Brüt m²</th>
              <th className="py-1 pr-2 text-right">KDV hariç</th>
              <th className="py-1 pr-2 text-right">KDV</th>
              <th className="py-1 text-right">KDV dahil</th>
            </tr>
          </thead>
          <tbody>
            {data.contractor.map((r) => (
              <tr key={r.unit.id} className="border-b border-neutral-300 break-inside-avoid">
                <td className="py-1 pr-2">{r.unit.block.name}</td>
                <td className="py-1 pr-2">{FLOOR_LABEL(r.unit.floor)}</td>
                <td className="py-1 pr-2">{r.unit.doorNo}</td>
                <td className="py-1 pr-2">{[USAGE_TYPE_LABELS[r.unit.usageType], r.unit.layout].filter(Boolean).join(" · ")}</td>
                <td className="py-1 pr-2">{[r.unit.facade, r.unit.view].filter(Boolean).join(" · ")}</td>
                <td className="py-1 pr-2 text-right tabular-nums">{formatNumber(r.unit.netArea, 2)}</td>
                <td className="py-1 pr-2 text-right tabular-nums">{formatNumber(r.unit.grossArea, 2)}</td>
                <td className="py-1 pr-2 text-right tabular-nums">{r.price ? formatMoney(r.price) : "—"}</td>
                <td className="py-1 pr-2 text-right tabular-nums">{r.vatRate ? `%${formatNumber(r.vatRate, 2)}` : "—"}</td>
                <td className="py-1 text-right font-medium tabular-nums">{r.priceWithVat ? formatMoney(r.priceWithVat) : "—"}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-black font-semibold">
              <td className="py-1" colSpan={7}>
                Toplam ({data.contractor.length} bölüm)
              </td>
              <td className="py-1 pr-2 text-right tabular-nums">{formatMoney(data.total)}</td>
              <td />
              <td className="py-1 text-right tabular-nums">{formatMoney(data.totalWithVat)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      {data.landowner.length > 0 && (
        <p className="mt-4 text-neutral-600">
          Arsa sahibi bölümleri (satışa kapalı): {data.landowner.map((r) => `${r.unit.block.name} No ${r.unit.doorNo}`).join(", ")}.
        </p>
      )}
    </main>
  );
}
