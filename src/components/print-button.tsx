"use client";

import { useEffect } from "react";
import { PrinterIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Sayfa açılınca yazdırma penceresini açar; "PDF olarak kaydet" ile PDF alınır. */
export function PrintButton() {
  useEffect(() => {
    const timer = setTimeout(() => window.print(), 400);
    return () => clearTimeout(timer);
  }, []);
  return (
    <Button onClick={() => window.print()} className="print:hidden">
      <PrinterIcon />
      Yazdır / PDF olarak kaydet
    </Button>
  );
}
