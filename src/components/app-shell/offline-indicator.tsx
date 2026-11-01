"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { CloudUploadIcon, WifiOffIcon } from "lucide-react";
import { listOutbox, OUTBOX_EVENT } from "@/lib/offline/outbox";
import { syncOutbox } from "@/lib/offline/sync";
import { cn } from "@/lib/utils";

/**
 * Çevrimdışı durum ve telefonda bekleyen kayıtlar (Faz 8). Bağlantı gelince ve uygulama açılınca
 * bekleyenleri gönderir; hızlı giriş sayfasının çevrimdışı açılabilmesi için service worker'ı kaydeder.
 */
export function OfflineIndicator({ owner }: { owner: string }) {
  const router = useRouter();
  const [online, setOnline] = useState(true);
  const [pending, setPending] = useState(0);

  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") navigator.serviceWorker.register("/sw.js").catch(() => {});
    const refreshCount = () => listOutbox(owner).then((l) => setPending(l.length)).catch(() => {});
    const sync = async () => {
      setOnline(navigator.onLine);
      if (!navigator.onLine) return;
      const sent = await syncOutbox(owner).catch(() => 0);
      if (sent > 0) router.refresh();
      refreshCount();
    };
    const offline = () => setOnline(false);
    void sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", offline);
    window.addEventListener(OUTBOX_EVENT, refreshCount);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", offline);
      window.removeEventListener(OUTBOX_EVENT, refreshCount);
    };
  }, [owner, router]);

  if (online && pending === 0) return null;
  return (
    <Link
      href="/offline"
      className={cn("flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap", online ? "border-sky-300 bg-sky-50 text-sky-800" : "border-amber-300 bg-amber-50 text-amber-900")}
      title={online ? "Gönderilmeyi bekleyen kayıtlar" : "İnternet yok; kayıtlar telefonda bekletilir"}
    >
      {online ? <CloudUploadIcon className="size-3.5" /> : <WifiOffIcon className="size-3.5" />}
      {online ? `${pending} bekleyen` : pending ? `Çevrimdışı · ${pending}` : "Çevrimdışı"}
    </Link>
  );
}
