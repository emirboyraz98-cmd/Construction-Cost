import type { Metadata } from "next";
import Link from "next/link";
import { PencilIcon, UserPlusIcon } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { hasCapability, ROLE_LABELS } from "@/lib/auth/roles";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { getAccess } from "@/server/access";
import { listUsers } from "@/server/users";
import { NoUserManagement } from "./no-access";

export const metadata: Metadata = { title: "Kullanıcılar" };

export default async function UsersPage() {
  const { user: me } = await getAccess();
  if (!hasCapability(me.role, "users.manage")) return <NoUserManagement />;
  const users = await listUsers();

  const projectsText = (user: (typeof users)[number]) =>
    user.role === "yonetici" ? "Tüm projeler" : `${user._count.permissions} proje`;

  return (
    <>
      <PageHeader
        title="Kullanıcılar"
        description="Kullanıcı ekleyin, pasifleştirin; rol ve proje yetkisi verin."
        actions={
          <Button asChild>
            <Link href="/settings/users/new">
              <UserPlusIcon />
              Kullanıcı ekle
            </Link>
          </Button>
        }
      />

      <Card className="hidden py-0 md:flex">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4">Ad soyad</TableHead>
              <TableHead>E-posta</TableHead>
              <TableHead>Rol</TableHead>
              <TableHead>Projeler</TableHead>
              <TableHead>Son giriş</TableHead>
              <TableHead>Durum</TableHead>
              <TableHead className="pr-4" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.id} className={cn(!user.active && "text-muted-foreground")}>
                <TableCell className="pl-4 font-medium">
                  {user.name}
                  {user.id === me.id && <span className="ml-1 text-xs text-muted-foreground">(siz)</span>}
                </TableCell>
                <TableCell>{user.email}</TableCell>
                <TableCell>{ROLE_LABELS[user.role]}</TableCell>
                <TableCell>{projectsText(user)}</TableCell>
                <TableCell>{formatDateTime(user.lastLoginAt)}</TableCell>
                <TableCell>
                  <Badge variant={user.active ? "secondary" : "outline"}>{user.active ? "Aktif" : "Pasif"}</Badge>
                </TableCell>
                <TableCell className="pr-4 text-right">
                  <Button asChild variant="ghost" size="sm">
                    <Link href={`/settings/users/${user.id}`}>
                      <PencilIcon />
                      Düzenle
                    </Link>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <div className="grid gap-3 md:hidden">
        {users.map((user) => (
          <Link key={user.id} href={`/settings/users/${user.id}`}>
            <Card className={cn("gap-1 py-4", !user.active && "opacity-70")}>
              <CardContent className="grid gap-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{user.name}</span>
                  <Badge variant={user.active ? "secondary" : "outline"}>{user.active ? "Aktif" : "Pasif"}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {user.email} · {ROLE_LABELS[user.role]} · {projectsText(user)}
                </p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </>
  );
}
