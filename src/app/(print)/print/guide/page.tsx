import type { Metadata } from "next";
import { GUIDE_TOC, GuideContent } from "@/components/guide/guide-content";
import { PrintSheet } from "@/components/print-sheet";
import { getAccess } from "@/server/access";

export const metadata: Metadata = { title: "Kullanım kılavuzu (PDF)" };

export default async function GuidePrintPage() {
  await getAccess();
  return (
    <PrintSheet title="İnşaat Maliyet – Kullanım kılavuzu" subtitle="Örnek bir projeyi baştan sona kurarak programın tamamı">
      <nav aria-label="İçindekiler" className="mb-8 text-sm">
        <p className="mb-1 font-semibold">İçindekiler</p>
        <ol className="grid gap-0.5">
          {GUIDE_TOC.map((s) => (
            <li key={s.id}>{s.title}</li>
          ))}
        </ol>
      </nav>
      <GuideContent print />
    </PrintSheet>
  );
}
