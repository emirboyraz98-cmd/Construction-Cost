import { AppShell } from "@/components/app-shell/app-shell";
import type { Role } from "@/generated/prisma/enums";
import { projectRole } from "@/lib/auth/access";
import { hasCapability } from "@/lib/auth/roles";
import { getAccess } from "@/server/access";
import { listProjectSummaries } from "@/server/projects";
import { listOpenTabs } from "@/server/tabs";
import { isAdvancedView } from "@/server/view-mode";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const { user, scope } = await getAccess();
  const [projects, tabs, advanced] = await Promise.all([listProjectSummaries(), listOpenTabs(), isAdvancedView()]);
  const projectRoles: Record<string, Role> = {};
  for (const project of projects) {
    const role = projectRole(scope, project.id);
    if (role) projectRoles[project.id] = role;
  }

  return (
    <AppShell
      user={{ name: user.name, email: user.email, role: user.role }}
      projects={projects}
      tabs={tabs.map((tab) => ({ projectId: tab.projectId, name: tab.name }))}
      projectRoles={projectRoles}
      canCreateProject={hasCapability(user.role, "project.create")}
      canManageUsers={hasCapability(user.role, "users.manage")}
      advanced={advanced}
    >
      {children}
    </AppShell>
  );
}
