"use client";

import { useState, type ReactNode } from "react";
import { ChevronDownIcon } from "lucide-react";
import { useAdvancedView } from "@/components/view-mode";
import { cn } from "@/lib/utils";

/**
 * Özet kartında ikincil rakamlar: basit görünümde “Ayrıntılar” düğmesinin arkasında,
 * gelişmiş görünümde açık. Izgara içinde kullanılır (çocuklar ızgaranın hücresi olur).
 */
export function MoreFigures({ children, label = "Ayrıntılar" }: { children: ReactNode; label?: string }) {
  const advanced = useAdvancedView();
  const [open, setOpen] = useState(advanced);
  return (
    <>
      {open && <div className="contents">{children}</div>}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="col-span-full inline-flex items-center gap-1 justify-self-start text-xs font-medium text-primary hover:underline print:hidden"
      >
        {open ? `${label}ı gizle` : `${label}ı göster`}
        <ChevronDownIcon className={cn("size-3.5 transition-transform", open && "rotate-180")} aria-hidden />
      </button>
    </>
  );
}
