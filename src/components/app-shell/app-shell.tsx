"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { Building2Icon, MenuIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import type { Role } from "@/generated/prisma/enums";
import { NotificationBell } from "./notification-bell";
import { OfflineIndicator } from "./offline-indicator";
import { ProjectPicker } from "./project-picker";
import { SideNav } from "./side-nav";
import { TabBar } from "./tab-bar";
import type { ShellProject, ShellTab, ShellUser } from "./types";
import { UserMenu } from "./user-menu";
import { SectionTabs } from "./section-tabs";
import { ViewModeProvider } from "@/components/view-mode";

/** Yerleşim: üstte proje sekmeleri (mobilde proje seçici), solda menü, içerikte bölüm sekmeleri. */
export function AppShell({
  user,
  projects,
  tabs,
  projectRoles,
  canCreateProject,
  canManageUsers,
  advanced,
  children,
}: {
  user: ShellUser;
  projects: ShellProject[];
  tabs: ShellTab[];
  projectRoles: Record<string, Role>;
  canCreateProject: boolean;
  canManageUsers: boolean;
  advanced: boolean;
  children: ReactNode;
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-40 border-b bg-tabbar">
        <div className="flex h-14 items-center gap-2 px-2 md:h-12 md:items-end md:gap-1 md:px-3">
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setMenuOpen(true)}
            aria-label="Menüyü aç"
          >
            <MenuIcon className="size-5" />
          </Button>
          <Link
            href="/portfolio"
            className="hidden shrink-0 items-center self-center pr-2 text-primary md:flex"
            title="İnşaat Maliyet — Portföy"
          >
            <Building2Icon className="size-6" />
          </Link>

          <div className="hidden min-w-0 flex-1 self-stretch md:flex">
            <TabBar tabs={tabs} projects={projects} canCreateProject={canCreateProject} />
          </div>
          <div className="flex min-w-0 flex-1 md:hidden">
            <ProjectPicker tabs={tabs} projects={projects} canCreateProject={canCreateProject} />
          </div>

          <div className="flex items-center gap-1 self-center">
            <OfflineIndicator owner={user.email} />
            <NotificationBell />
            <UserMenu user={user} canManageUsers={canManageUsers} advanced={advanced} />
          </div>
        </div>
      </header>

      <div className="flex flex-1">
        <aside className="sticky top-12 hidden h-[calc(100dvh-3rem)] w-60 shrink-0 overflow-y-auto border-r bg-sidebar md:block">
          <SideNav projects={projects} projectRoles={projectRoles} userRole={user.role} advanced={advanced} />
        </aside>
        <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
          <SheetContent side="left" className="bg-sidebar p-0 pt-10">
            <SheetTitle className="sr-only">Menü</SheetTitle>
            <SheetDescription className="sr-only">Proje ve şirket ekranları</SheetDescription>
            <SideNav
              projects={projects}
              projectRoles={projectRoles}
              userRole={user.role}
              advanced={advanced}
              onNavigate={() => setMenuOpen(false)}
            />
          </SheetContent>
        </Sheet>
        <main className="min-w-0 flex-1 px-4 py-5 md:px-6 md:py-6">
          <ViewModeProvider advanced={advanced}>
            <SectionTabs projectRoles={projectRoles} userRole={user.role} advanced={advanced} />
            {children}
          </ViewModeProvider>
        </main>
      </div>
    </div>
  );
}
