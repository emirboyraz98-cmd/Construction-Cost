import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { hasCapability } from "@/lib/auth/roles";
import { getAccess } from "@/server/access";
import { listProjectSummaries } from "@/server/projects";
import { getUserForEdit } from "@/server/users";
import { NoUserManagement } from "../no-access";
import { UserForm } from "../user-form";

export const metadata: Metadata = { title: "Kullanıcıyı düzenle" };

export default async function EditUserPage({ params }: PageProps<"/settings/users/[userId]">) {
  const { user: me } = await getAccess();
  if (!hasCapability(me.role, "users.manage")) return <NoUserManagement />;
  const { userId } = await params;
  const [user, projects] = await Promise.all([getUserForEdit(userId), listProjectSummaries()]);
  if (!user) notFound();

  return (
    <>
      <PageHeader title={user.name} description="Kullanıcıyı düzenle" />
      <UserForm
        userId={user.id}
        isSelf={user.id === me.id}
        projects={projects}
        initial={{
          name: user.name,
          email: user.email,
          phone: user.phone ?? "",
          role: user.role,
          active: user.active,
          permissions: Object.fromEntries(user.permissions.map((p) => [p.projectId, p.role])),
        }}
      />
    </>
  );
}
