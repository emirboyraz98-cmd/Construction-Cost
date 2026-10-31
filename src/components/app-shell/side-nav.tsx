"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import {
  BanknoteIcon,
  Building2Icon,
  CalendarClockIcon,
  FileSignatureIcon,
  GaugeIcon,
  HandshakeIcon,
  LayoutGridIcon,
  type LucideIcon,
  ReceiptTextIcon,
  SettingsIcon,
  TrendingUpIcon,
  WalletIcon,
} from "lucide-react";
import type { Role } from "@/generated/prisma/enums";
import { hasCapability } from "@/lib/auth/roles";
import { PROJECT_STATUS_LABELS } from "@/lib/labels";
import { COMPANY_MODULES, COMPANY_SECTIONS, companyKey, PROJECT_MODULES, PROJECT_SECTIONS, projectModuleHref, projectSegment, visibleTabs } from "@/lib/modules";
import { cn } from "@/lib/utils";
import type { ShellProject } from "./types";

const PROJECT_ICONS: Record<string, LucideIcon> = {
  panel: GaugeIcon,
  expenses: ReceiptTextIcon,
  building: Building2Icon,
  budget: WalletIcon,
  sales: FileSignatureIcon,
  money: BanknoteIcon,
};

const COMPANY_ICONS: Record<string, LucideIcon> = {
  portfolio: LayoutGridIcon,
  purchasing: HandshakeIcon,
  payments: CalendarClockIcon,
  reports: TrendingUpIcon,
  settings: SettingsIcon,
};

/** Modül anahtarının kullanıcıya açık olup olmadığı. */
export function canSeeProjectModule(role: Role | null | undefined, key: string) {
  const m = PROJECT_MODULES.find((x) => x.key === key);
  return Boolean(m && !m.phase && (!m.capability || hasCapability(role ?? null, m.capability)));
}
export function canSeeCompanyModule(role: Role, key: string) {
  const m = COMPANY_MODULES.find((x) => x.key === key);
  return Boolean(m && !m.phase && (!m.capability || hasCapability(role, m.capability)));
}
export function companyHref(key: string) {
  return COMPANY_MODULES.find((m) => m.key === key)?.href ?? "/";
}

function NavLink({
  href,
  icon: Icon,
  label,
  active,
  title,
  onNavigate,
}: {
  href: string;
  icon: LucideIcon;
  label: string;
  active: boolean;
  title?: string;
  onNavigate?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      title={title}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex min-h-10 items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors md:min-h-0 md:py-1.5",
        active
          ? "bg-primary/10 font-medium text-primary"
          : "text-foreground/80 hover:bg-accent hover:text-foreground",
      )}
    >
      <Icon className="size-4 shrink-0" />
      <span className="min-w-0 flex-1 truncate">{label}</span>

    </Link>
  );
}

/** Sol menü: seçili projenin 6 bölümü, altında şirket geneli 5 bölüm. Alt ekranlar sayfa üstünde sekmedir. */
export function SideNav({
  projects,
  projectRoles,
  userRole,
  advanced,
  onNavigate,
}: {
  projects: ShellProject[];
  projectRoles: Record<string, Role>;
  userRole: Role;
  advanced: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const { projectId } = useParams<{ projectId?: string }>();
  const project = projectId ? projects.find((p) => p.id === projectId) : undefined;
  const role = project ? projectRoles[project.id] : null;
  const activeProjectKey = projectSegment(pathname)?.key ?? null;
  const activeCompanyKey = companyKey(pathname);

  return (
    <div className="flex flex-col gap-5 p-3">
      <section>
        <h2 className="px-2.5 pb-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          Proje
        </h2>
        {project ? (
          <>
            <div className="mb-1.5 px-2.5">
              <p className="truncate text-sm font-semibold" title={project.name}>
                {project.name}
              </p>
              <p className="text-xs text-muted-foreground">{PROJECT_STATUS_LABELS[project.status]}</p>
            </div>
            <nav className="grid grid-cols-1 gap-0.5" aria-label="Proje modülleri">
              {PROJECT_SECTIONS.map((section) => {
                const tabs = visibleTabs(section, (k) => canSeeProjectModule(role, k), advanced, activeProjectKey);
                if (tabs.length === 0) return null;
                const active = activeProjectKey !== null && section.tabs.some((t) => t.key === activeProjectKey);
                return (
                  <NavLink
                    key={section.id}
                    href={projectModuleHref(project.id, tabs[0].key)}
                    icon={PROJECT_ICONS[section.id] ?? GaugeIcon}
                    label={section.label}
                    title={section.description}
                    active={active}
                    onNavigate={onNavigate}
                  />
                );
              })}
            </nav>
          </>
        ) : (
          <p className="rounded-md border border-dashed px-2.5 py-2 text-xs text-muted-foreground">
            Proje ekranları için üstten bir proje sekmesi açın veya{" "}
            <Link href="/projects" className="text-primary underline" onClick={onNavigate}>
              proje listesinden
            </Link>{" "}
            seçin.
          </p>
        )}
      </section>

      <section>
        <h2 className="px-2.5 pb-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          Şirket geneli
        </h2>
        <nav className="grid grid-cols-1 gap-0.5" aria-label="Şirket geneli">
          {COMPANY_SECTIONS.map((section) => {
            const tabs = visibleTabs(section, (k) => canSeeCompanyModule(userRole, k), advanced, activeCompanyKey);
            if (tabs.length === 0) return null;
            const active = activeCompanyKey !== null && section.tabs.some((t) => t.key === activeCompanyKey);
            return (
              <NavLink
                key={section.id}
                href={companyHref(tabs[0].key)}
                icon={COMPANY_ICONS[section.id] ?? SettingsIcon}
                label={section.label}
                title={section.description}
                active={active}
                onNavigate={onNavigate}
              />
            );
          })}
        </nav>
      </section>
    </div>
  );
}
