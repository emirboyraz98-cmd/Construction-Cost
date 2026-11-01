import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { getNotifications } from "@/server/notifications";

export const metadata: Metadata = { title: "Bildirimler" };

const DOT = { danger: "bg-destructive", warning: "bg-amber-500", info: "bg-sky-500" } as const;
const LEVEL = { danger: "Acil", warning: "Yapılacak", info: "Bilgi" } as const;

export default async function NotificationsPage() {
  const items = await getNotifications();
  return (
    <>
      <PageHeader title="Bildirimler" description="Sizi bekleyen işler. İş bitince listeden kendiliğinden düşer." />
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Bekleyen iş veya uyarı yok.</p>
      ) : (
        <Card className="gap-0 py-0">
          <ul className="divide-y">
            {items.map((n) => (
              <li key={n.key}>
                <Link href={n.href} className="flex gap-3 px-4 py-3 hover:bg-muted/50">
                  <span className={cn("mt-1.5 size-2.5 shrink-0 rounded-full", DOT[n.level])} aria-hidden />
                  <span className="min-w-0">
                    <span className="block font-medium">
                      {n.title} <span className="text-xs font-normal text-muted-foreground">· {LEVEL[n.level]}</span>
                    </span>
                    <span className="block text-sm text-muted-foreground">{n.detail}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}
