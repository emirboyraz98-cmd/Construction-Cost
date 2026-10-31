import type { Metadata } from "next";
import Link from "next/link";
import { PrinterIcon } from "lucide-react";
import { GUIDE_TOC, GuideContent } from "@/components/guide/guide-content";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { getAccess } from "@/server/access";

export const metadata: Metadata = { title: "Kullanım kılavuzu" };

export default async function GuidePage() {
  await getAccess();
  return (
    <>
      <PageHeader
        title="Kullanım kılavuzu"
        description="Örnek bir projeyi baştan sona kurarak programın tamamı, ekran görüntüleriyle."
        actions={
          <Button asChild variant="outline">
            <a href="/print/guide" target="_blank" rel="noopener">
              <PrinterIcon />
              PDF olarak indir
            </a>
          </Button>
        }
      />
      <div className="grid gap-8 xl:grid-cols-[16rem_minmax(0,1fr)]">
        <nav aria-label="İçindekiler" className="h-fit rounded-xl border bg-card p-4 text-sm xl:sticky xl:top-20">
          <p className="mb-2 font-medium">İçindekiler</p>
          <ol className="grid gap-1.5">
            {GUIDE_TOC.map((s) => (
              <li key={s.id}>
                <Link href={`#${s.id}`} className="hover:text-primary hover:underline">
                  {s.title}
                </Link>
                {s.items && (
                  <ol className="mt-1 grid gap-1 border-l pl-3 text-muted-foreground">
                    {s.items.map((i) => (
                      <li key={i.id}>
                        <Link href={`#${i.id}`} className="hover:text-primary hover:underline">
                          {i.title}
                        </Link>
                      </li>
                    ))}
                  </ol>
                )}
              </li>
            ))}
          </ol>
        </nav>
        <div className="min-w-0">
          <GuideContent />
        </div>
      </div>
    </>
  );
}
