import type { Metadata } from "next";
import { DownloadIcon } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { NoAccess } from "@/components/purchasing/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { hasCapability } from "@/lib/auth/roles";
import { formatDateTime } from "@/lib/format";
import { getAccess } from "@/server/access";
import { listBackupFiles } from "@/server/admin";
import { BackupButton } from "./backup-button";

export const metadata: Metadata = { title: "Yedekler" };

export default async function BackupsPage() {
  const { user } = await getAccess();
  if (!hasCapability(user.role, "backup.manage")) return <NoAccess text="Yedekleri yalnızca yönetici yönetir." />;
  const data = await listBackupFiles();
  const last = data.files[0];
  const today = new Date().toDateString();
  return (
    <>
      <PageHeader title="Yedekler" description="Program her açılışta ve açık kaldığı sürece günde bir kez otomatik yedek alır (veritabanı + fiş / fatura fotoğrafları). Son yedekler saklanır, eskiler silinir." />
      <div className="grid max-w-3xl grid-cols-1 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>{last ? (new Date(last.createdAt).toDateString() === today ? "Bugünün yedeği alındı" : "Son yedek eski") : "Henüz yedek yok"}</CardTitle>
            <CardDescription>
              {last ? `Son yedek: ${formatDateTime(last.createdAt)}. ` : ""}Klasör: <span className="font-mono text-xs break-all">{data.dir}</span>. Son {data.keep} yedek tutulur.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm">
            <BackupButton />
            <p className="text-muted-foreground">
              Bilgisayar bozulursa yedek de gider: yedekleri ayda bir harici diske kopyalayın ya da <code>.env</code> dosyasına <code>BACKUP_DIR=</code> ile OneDrive / Google Drive klasörü yazın (README → Yedek). Geri yüklemek için programı kapatıp <b>geri-yukle.bat</b> çalıştırın.
            </p>
          </CardContent>
        </Card>
        <Card className="gap-0 py-0">
          {data.files.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted-foreground">Yedek dosyası yok.</p>
          ) : (
            <ul className="divide-y text-sm">
              {data.files.map((f) => (
                <li key={f.name} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2">
                  <span className="min-w-0">
                    <span className="block font-medium">{formatDateTime(f.createdAt)}</span>
                    <span className="block text-xs text-muted-foreground">
                      {f.name} · {(f.size / 1024 / 1024).toFixed(1)} MB
                    </span>
                  </span>
                  <Button asChild size="sm" variant="outline">
                    <a href={`/api/backups/${encodeURIComponent(f.name)}`}>
                      <DownloadIcon />
                      İndir
                    </a>
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
