import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRightIcon, CoinsIcon, DatabaseBackupIcon, HistoryIcon, KeyRoundIcon, ListTreeIcon, PercentIcon, UsersIcon } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { hasCapability } from "@/lib/auth/roles";
import { getAccess } from "@/server/access";

export const metadata: Metadata = { title: "Ayarlar" };


export default async function SettingsPage() {
  const { user } = await getAccess();
  const links = [
    ...(hasCapability(user.role, "users.manage")
      ? [{ href: "/settings/users", icon: UsersIcon, label: "Kullanıcılar", note: "Kullanıcı ekle / pasifleştir, rol ve proje yetkileri" }]
      : []),
    ...(hasCapability(user.role, "rates.manage")
      ? [{ href: "/settings/rates", icon: CoinsIcon, label: "Döviz kurları", note: "TCMB'den getir veya elle gir" }]
      : []),
    ...(hasCapability(user.role, "parameters.manage")
      ? [{ href: "/settings/parameters", icon: PercentIcon, label: "Vergi, harç ve oran parametreleri", note: "KDV oranları; yıl / belediye bazında oranlar" }]
      : []),
    ...(hasCapability(user.role, "costTree.edit")
      ? [{ href: "/settings/template", icon: ListTreeIcon, label: "Maliyet ağacı şablonu", note: "Yeni projelerin maliyet kalemleri: ekle / pasifleştir" }]
      : []),
    ...(hasCapability(user.role, "backup.manage")
      ? [{ href: "/settings/backups", icon: DatabaseBackupIcon, label: "Yedekler", note: "Otomatik günlük yedekler, şimdi yedek al, indir" }]
      : []),
    ...(hasCapability(user.role, "audit.view")
      ? [{ href: "/settings/history", icon: HistoryIcon, label: "Değişiklik geçmişi", note: "Kim neyi ne zaman ekledi, değiştirdi, sildi" }]
      : []),
    { href: "/settings/account", icon: KeyRoundIcon, label: "Hesabım", note: "Şifre değiştir" },
  ];

  return (
    <>
      <PageHeader title="Ayarlar" />
      <div className="grid max-w-2xl gap-3">
        {links.map((link) => (
          <Link key={link.href} href={link.href}>
            <Card className="py-4 transition-shadow hover:shadow-md">
              <CardContent className="flex items-center gap-3">
                <link.icon className="size-5 text-primary" />
                <div className="flex-1">
                  <p className="font-medium">{link.label}</p>
                  <p className="text-sm text-muted-foreground">{link.note}</p>
                </div>
                <ChevronRightIcon className="size-4 text-muted-foreground" />
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </>
  );
}
