"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { CloudUploadIcon, ImageIcon, SendIcon, Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatDateTime } from "@/lib/format";
import { listOutbox, OUTBOX_EVENT, removeFromOutbox, type OutboxEntry } from "@/lib/offline/outbox";
import { sendEntry, syncOutbox } from "@/lib/offline/sync";
import { cn } from "@/lib/utils";

export function OutboxList({ owner }: { owner: string }) {
  const router = useRouter();
  const [entries, setEntries] = useState<OutboxEntry[] | null>(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => listOutbox(owner).then(setEntries).catch(() => setEntries([])), [owner]);
  useEffect(() => {
    void load();
    window.addEventListener(OUTBOX_EVENT, load);
    return () => window.removeEventListener(OUTBOX_EVENT, load);
  }, [load]);
  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await fn();
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  if (entries === null) return <p className="text-sm text-muted-foreground">Yükleniyor…</p>;
  if (entries.length === 0) return <p className="text-sm text-muted-foreground">Bu telefonda bekleyen kayıt yok.</p>;
  return (
    <div className="grid grid-cols-1 gap-3">
      <div>
        <Button disabled={busy} onClick={() => run(() => syncOutbox(owner))}>
          <CloudUploadIcon />
          Şimdi gönder
        </Button>
      </div>
      <Card className="gap-0 py-0">
        <ul className="divide-y">
          {entries.map((e) => (
            <li key={e.id} className="grid grid-cols-1 gap-1 px-4 py-3 text-sm sm:grid-cols-[1fr_auto] sm:items-center">
              <span className="min-w-0">
                <span className="block font-medium">{e.summary || "Harcama"}</span>
                <span className="block text-xs text-muted-foreground">
                  {e.projectName} · girildi {formatDateTime(e.createdAt)}
                  {e.files.length > 0 && (
                    <>
                      {" "}
                      · <ImageIcon className="inline size-3" /> {e.files.length} belge
                    </>
                  )}
                </span>
                <span className={cn("block text-xs", e.status === "waiting" ? "text-sky-800" : e.status === "duplicate" ? "text-amber-800" : "text-destructive")}>
                  {e.status === "waiting" ? "Bağlantı gelince gönderilecek" : e.error}
                </span>
              </span>
              <span className="flex gap-1">
                <Button size="sm" variant="outline" disabled={busy} onClick={() => run(() => sendEntry(e, e.status === "duplicate"))}>
                  <SendIcon />
                  {e.status === "duplicate" ? "Yine de gönder" : "Gönder"}
                </Button>
                <Button size="sm" variant="ghost" className="text-destructive" disabled={busy} onClick={() => confirm("Bu kayıt telefondan silinsin mi? Gönderilmemiş bilgi kaybolur.") && run(() => removeFromOutbox(e.id))}>
                  <Trash2Icon />
                  Sil
                </Button>
              </span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
