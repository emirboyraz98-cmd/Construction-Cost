"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { BellIcon } from "lucide-react";
import { notificationsAction } from "@/app/(app)/actions";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { NotificationItem } from "@/server/notifications";
import { cn } from "@/lib/utils";

const DOT = { danger: "bg-destructive", warning: "bg-amber-500", info: "bg-sky-500" } as const;

/** Üst menüdeki bildirim zili: sayfa değişince ve 5 dakikada bir yenilenir. */
export function NotificationBell() {
  const [items, setItems] = useState<NotificationItem[] | null>(null);
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  useEffect(() => {
    let alive = true;
    const load = () =>
      notificationsAction()
        .then((r) => alive && setItems(r.items))
        .catch(() => {});
    load();
    const timer = setInterval(load, 5 * 60 * 1000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [pathname]);
  const count = items?.length ?? 0;
  const danger = items?.some((i) => i.level === "danger");
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label={count ? `${count} bildirim` : "Bildirimler"}>
          <BellIcon className="size-5" />
          {count > 0 && (
            <span className={cn("absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold text-white", danger ? "bg-destructive" : "bg-amber-600")}>
              {count > 9 ? "9+" : count}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <p className="border-b px-3 py-2 text-sm font-medium">Bildirimler</p>
        {items === null ? (
          <p className="px-3 py-4 text-sm text-muted-foreground">Yükleniyor…</p>
        ) : items.length === 0 ? (
          <p className="px-3 py-4 text-sm text-muted-foreground">Bekleyen iş veya uyarı yok.</p>
        ) : (
          <ul className="max-h-96 divide-y overflow-y-auto">
            {items.slice(0, 8).map((n) => (
              <li key={n.key}>
                <Link href={n.href} onClick={() => setOpen(false)} className="flex gap-2 px-3 py-2 text-sm hover:bg-muted">
                  <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", DOT[n.level])} aria-hidden />
                  <span className="min-w-0">
                    <span className="block font-medium">{n.title}</span>
                    <span className="block truncate text-xs text-muted-foreground">{n.detail}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        <Link href="/notifications" onClick={() => setOpen(false)} className="block border-t px-3 py-2 text-center text-xs font-medium text-primary hover:bg-muted">
          Tümünü gör
        </Link>
      </PopoverContent>
    </Popover>
  );
}
