"use client";

import { useEffect } from "react";
import { PrinterIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Sayfadaki tüm görseller yüklenince (en çok 10 sn) çözülür; resimsiz PDF çıkmasın. */
function imagesReady(timeoutMs = 10_000) {
  const pending = Array.from(document.images).filter((img) => !img.complete);
  if (pending.length === 0) return Promise.resolve();
  const loaded = Promise.all(
    pending.map(
      (img) =>
        new Promise<void>((resolve) => {
          img.addEventListener("load", () => resolve(), { once: true });
          img.addEventListener("error", () => resolve(), { once: true });
        }),
    ),
  );
  return Promise.race([loaded, new Promise<void>((resolve) => setTimeout(resolve, timeoutMs))]);
}

/** Sayfa açılınca yazdırma penceresini açar; "PDF olarak kaydet" ile PDF alınır. */
export function PrintButton() {
  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      void imagesReady().then(() => {
        if (!cancelled) window.print();
      });
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);
  return (
    <Button onClick={() => window.print()} className="print:hidden">
      <PrinterIcon />
      Yazdır / PDF olarak kaydet
    </Button>
  );
}
