import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRightIcon, KeyRoundIcon, UsersIcon } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { hasCapability } from "@/lib/auth/roles";
import { getAccess } from "@/server/access";

export const metadata: Metadata = { title: "Ayarlar" };

const UPCOMING = [
  { label: "Harç, vergi ve yapı denetim parametreleri", phase: 3, note: "Yıl / belediye bazında oranlar" },
  { label: "Döviz kurları", phase: 1, note: "TCMB günlük kurları ve elle giriş" },
  { label: "Birimler ve maliyet ağacı şablonu", phase: 3, note: "Varsayılan İKY şablonunun düzenlenmesi" },
];

export default async function SettingsPage() {
  const { user } = await getAccess();
  const links = [
    ...(hasCapability(user.role, "users.manage")
      ? [{ href: "/settings/users", icon: UsersIcon, label: "Kullanıcılar", note: "Kullanıcı ekle / pasifleştir, rol ve proje yetkileri" }]
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
        {UPCOMING.map((item) => (
          <Card key={item.label} className="py-4 opacity-80">
            <CardContent className="flex items-center gap-3">
              <div className="flex-1">
                <p className="font-medium">{item.label}</p>
                <p className="text-sm text-muted-foreground">{item.note}</p>
              </div>
              <Badge variant="soon">Faz {item.phase}</Badge>
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}
