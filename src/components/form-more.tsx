"use client";

import { useState, type ReactNode } from "react";
import { ChevronDownIcon } from "lucide-react";
import { useAdvancedView } from "@/components/view-mode";
import { cn } from "@/lib/utils";

/**
 * Formda isteğe bağlı alanlar: basit görünümde kapalı “Ayrıntılar” kutusu, gelişmiş görünümde açık.
 * `hasValue` true ise (kayıtta dolu alan var) kutu açık başlar; kullanıcı girdiğini görebilsin.
 */
export function FormMore({ children, title = "Ayrıntılar (isteğe bağlı)", hasValue = false, className }: { children: ReactNode; title?: string; hasValue?: boolean; className?: string }) {
  const advanced = useAdvancedView();
  const [open, setOpen] = useState(advanced || hasValue);
  return (
    <div className="grid gap-3 rounded-lg border border-dashed p-3">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="flex items-center justify-between gap-2 text-left text-sm font-medium">
        {title}
        <ChevronDownIcon className={cn("size-4 text-muted-foreground transition-transform", open && "rotate-180")} aria-hidden />
      </button>
      {open && <div className={cn("grid gap-3 sm:grid-cols-2", className)}>{children}</div>}
    </div>
  );
}
