"use client";

import { useRef, useState, type ReactNode } from "react";
import { InfoIcon } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { glossaryEntry, textOf, type GlossaryEntry } from "@/lib/glossary";
import { cn } from "@/lib/utils";

/**
 * ⓘ bilgi işareti: masaüstünde üstüne gelince, telefonda dokununca açıklama açılır.
 * `term` sözlükten aranır; `entry` ile doğrudan açıklama da verilebilir.
 */
export function InfoTip({ term, entry, title, className }: { term?: string; entry?: GlossaryEntry | null; title?: string; className?: string }) {
  const data = entry ?? glossaryEntry(term);
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastPointer = useRef<string>("mouse");
  if (!data) return null;
  const heading = title ?? term;

  const show = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setOpen(true);
  };
  const hide = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setOpen(false), 150);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={heading ? `${heading}: açıklama` : "Açıklama"}
          className={cn(
            "inline-flex size-4 shrink-0 translate-y-px items-center justify-center rounded-full align-middle text-muted-foreground/70 transition-colors outline-none hover:text-primary focus-visible:ring-2 focus-visible:ring-ring/50 print:hidden",
            className,
          )}
          onPointerEnter={(e) => {
            if (e.pointerType === "mouse") show();
          }}
          onPointerLeave={(e) => {
            if (e.pointerType === "mouse") hide();
          }}
          onPointerDown={(e) => {
            lastPointer.current = e.pointerType;
          }}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            // Fareyle üstüne gelince zaten açılır; tıklama kapatmasın. Dokunmada aç / kapat.
            if (lastPointer.current === "mouse") setOpen(true);
            else setOpen((v) => !v);
          }}
        >
          <InfoIcon className="size-3.5" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="start"
        className="w-80 max-w-[calc(100vw-2rem)] p-3 text-sm font-normal leading-relaxed"
        onPointerEnter={(e) => {
          if (e.pointerType === "mouse") show();
        }}
        onPointerLeave={(e) => {
          if (e.pointerType === "mouse") hide();
        }}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        {heading && <p className="mb-1 font-semibold">{heading.replace(/\s*\*$/, "")}</p>}
        <p>{data.t}</p>
        {data.w && (
          <p className="mt-2 text-muted-foreground">
            <span className="font-medium text-foreground">Neden önemli? </span>
            {data.w}
          </p>
        )}
        {data.e && (
          <p className="mt-2 rounded-md bg-muted px-2 py-1.5 text-xs">
            <span className="font-medium">Örnek: </span>
            {data.e}
          </p>
        )}
      </PopoverContent>
    </Popover>
  );
}

/** Yazı + (sözlükte varsa) ⓘ. */
export function WithInfo({ children, term, className }: { children: ReactNode; term?: string; className?: string }) {
  const label = term ?? textOf(children).trim();
  const entry = glossaryEntry(label);
  if (!entry) return <>{children}</>;
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      {children}
      <InfoTip entry={entry} title={label} />
    </span>
  );
}
