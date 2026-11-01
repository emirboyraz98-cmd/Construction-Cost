import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { hasCapability } from "@/lib/auth/roles";
import { getAccess } from "@/server/access";
import { listProjectSummaries } from "@/server/projects";
import { NoUserManagement } from "../no-access";
import { UserForm } from "../user-form";

export const metadata: Metadata = { title: "Kullanıcı ekle" };

export default async function NewUserPage() {
  const { user } = await getAccess();
  if (!hasCapability(user.role, "users.manage")) return <NoUserManagement />;
  const projects = await listProjectSummaries();

  return (
    <>
      <PageHeader title="Kullanıcı ekle" />
      <UserForm
        projects={projects}
        initial={{ name: "", email: "", phone: "", role: "santiye_sefi", active: true, permissions: {} }}
      />
    </>
  );
}
