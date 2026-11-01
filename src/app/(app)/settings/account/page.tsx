import type { Metadata } from "next";
import { InfoList } from "@/components/info-list";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ROLE_LABELS } from "@/lib/auth/roles";
import { getAccess } from "@/server/access";
import { PasswordForm } from "./password-form";

export const metadata: Metadata = { title: "Hesabım" };

export default async function AccountPage() {
  const { user, scope } = await getAccess();
  return (
    <>
      <PageHeader title="Hesabım" />
      <div className="grid max-w-xl gap-4">
        <Card>
          <CardContent>
            <InfoList
              items={[
                { label: "Ad soyad", value: user.name },
                { label: "E-posta", value: user.email },
                { label: "Rol", value: ROLE_LABELS[user.role] },
                {
                  label: "Projeler",
                  value: scope.all ? "Tüm projeler" : `${scope.grants.size} projeye yetkili`,
                },
              ]}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Şifre değiştir</CardTitle>
          </CardHeader>
          <CardContent>
            <PasswordForm />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
