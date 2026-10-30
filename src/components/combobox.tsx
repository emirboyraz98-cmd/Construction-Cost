"use client";

import { useId, useMemo, useRef, useState } from "react";
import { CheckIcon, ChevronsUpDownIcon, PlusIcon, XIcon } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn, normalizeForSearch } from "@/lib/utils";

export type ComboboxOption = {
  value: string;
  label: string;
  /** Aramada da kullanılan ikincil metin (ör. vergi no, kalem açıklaması) */
  hint?: string | null;
  /** Grup başlığı gibi kalın gösterilir (ör. üst maliyet kalemi) */
  emphasis?: boolean;
  indent?: number;
};

/**
 * Yazdıkça aranan seçim kutusu (maliyet kalemi, tedarikçi). Telefonda da açılır liste olarak çalışır.
 * `onCreate` verilirse listede olmayan değer için "+ Yeni …" satırı çıkar.
 */
export function Combobox({
  id,
  options,
  value,
  onChange,
  placeholder = "Seçin…",
  searchPlaceholder = "Ara…",
  emptyText = "Sonuç yok",
  createLabel,
  onCreate,
  clearable = false,
  invalid,
  disabled,
}: {
  id?: string;
  options: ComboboxOption[];
  value: string | null;
  onChange: (value: string | null) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  createLabel?: (query: string) => string;
  onCreate?: (query: string) => void;
  clearable?: boolean;
  invalid?: boolean;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);
  const listId = useId();
  const selected = options.find((option) => option.value === value);

  const filtered = useMemo(() => {
    const term = normalizeForSearch(query.trim());
    if (!term) return options;
    return options.filter((option) => normalizeForSearch(`${option.label} ${option.hint ?? ""}`).includes(term));
  }, [options, query]);
  const showCreate = Boolean(onCreate && query.trim());
  const total = filtered.length + (showCreate ? 1 : 0);

  function choose(index: number) {
    if (index < filtered.length) onChange(filtered[index].value);
    else if (showCreate) onCreate!(query.trim());
    setOpen(false);
    setQuery("");
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((current) => Math.min(current + 1, total - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((current) => Math.max(current - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (total > 0) choose(active);
    }
    listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        setQuery("");
        setActive(0);
      }}
    >
      <div className="relative">
        <PopoverTrigger asChild disabled={disabled}>
          <button
            id={id}
            type="button"
            role="combobox"
            aria-expanded={open}
            aria-controls={listId}
            aria-invalid={invalid || undefined}
            className={cn(
              "flex h-10 w-full items-center justify-between gap-2 rounded-md border border-input bg-background px-3 text-left text-base shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50 aria-invalid:border-destructive md:h-9 md:text-sm",
              clearable && selected && "pr-14",
            )}
          >
            <span className={cn("truncate", !selected && "text-muted-foreground")}>
              {selected?.label ?? placeholder}
            </span>
            <ChevronsUpDownIcon className="size-4 shrink-0 text-muted-foreground" />
          </button>
        </PopoverTrigger>
        {clearable && selected && !disabled && (
          <button
            type="button"
            className="absolute top-1/2 right-8 -translate-y-1/2 rounded p-1 text-muted-foreground hover:bg-muted"
            onClick={() => onChange(null)}
            aria-label="Seçimi temizle"
          >
            <XIcon className="size-3.5" />
          </button>
        )}
      </div>
      <PopoverContent className="w-(--radix-popover-trigger-width) min-w-64 p-0" onOpenAutoFocus={(e) => e.preventDefault()}>
        <input
          autoFocus
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setActive(0);
          }}
          onKeyDown={onKeyDown}
          placeholder={searchPlaceholder}
          className="h-11 w-full border-b bg-transparent px-3 text-base outline-none md:h-10 md:text-sm"
          aria-label={searchPlaceholder}
        />
        <ul ref={listRef} id={listId} role="listbox" className="max-h-72 overflow-y-auto py-1">
          {filtered.map((option, index) => (
            <li
              key={option.value}
              data-index={index}
              role="option"
              aria-selected={option.value === value}
              onMouseEnter={() => setActive(index)}
              onClick={() => choose(index)}
              className={cn(
                "flex cursor-pointer items-start gap-2 px-3 py-2 text-sm",
                index === active && "bg-accent",
                option.emphasis && "font-medium",
              )}
              style={option.indent ? { paddingLeft: `${0.75 + option.indent * 0.75}rem` } : undefined}
            >
              <CheckIcon className={cn("mt-0.5 size-4 shrink-0", option.value === value ? "opacity-100" : "opacity-0")} />
              <span className="min-w-0">
                <span className="block">{option.label}</span>
                {option.hint && <span className="block text-xs font-normal text-muted-foreground">{option.hint}</span>}
              </span>
            </li>
          ))}
          {showCreate && (
            <li
              data-index={filtered.length}
              role="option"
              aria-selected={false}
              onMouseEnter={() => setActive(filtered.length)}
              onClick={() => choose(filtered.length)}
              className={cn(
                "flex cursor-pointer items-center gap-2 border-t px-3 py-2 text-sm text-primary",
                active === filtered.length && "bg-accent",
              )}
            >
              <PlusIcon className="size-4" />
              {createLabel ? createLabel(query.trim()) : `“${query.trim()}” ekle`}
            </li>
          )}
          {total === 0 && <li className="px-3 py-3 text-sm text-muted-foreground">{emptyText}</li>}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
