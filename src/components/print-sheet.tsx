import type { ReactNode } from "react";
import { PrintButton } from "./print-button";

/** Yazdırılabilir A4 sayfa iskeleti (tarayıcıda "PDF olarak kaydet"). */
export function PrintSheet({ title, subtitle, landscape = false, children }: { title: string; subtitle: string; landscape?: boolean; children: ReactNode }) {
  return (
    <main className="mx-auto max-w-4xl bg-white p-6 text-[12px] text-black print:max-w-none print:p-0">
      <style>{`@page { size: A4 ${landscape ? "landscape" : "portrait"}; margin: 14mm; }`}</style>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3 border-b-2 border-black pb-2">
        <div>
          <h1 className="text-lg font-semibold">{title}</h1>
          <p className="text-neutral-600">{subtitle}</p>
        </div>
        <PrintButton />
      </div>
      <div className="overflow-x-auto print:overflow-visible">{children}</div>
    </main>
  );
}

/** İmza kutuları. */
export function Signatures({ labels }: { labels: string[] }) {
  return (
    <div className="mt-8 grid gap-4 break-inside-avoid" style={{ gridTemplateColumns: `repeat(${labels.length}, minmax(0, 1fr))` }}>
      {labels.map((l) => (
        <div key={l} className="border-t border-black pt-1 text-center text-neutral-700">
          {l}
          <div className="h-12" />
        </div>
      ))}
    </div>
  );
}
