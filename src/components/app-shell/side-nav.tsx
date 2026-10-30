"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import {
  BanknoteIcon,
  BarChart3Icon,
  BlocksIcon,
  BookOpenIcon,
  CalculatorIcon,
  FileSignatureIcon,
  FolderKanbanIcon,
  GaugeIcon,
  HandCoinsIcon,
  HandshakeIcon,
  LandPlotIcon,
  LayoutGridIcon,
  ListTreeIcon,
  type LucideIcon,
  ReceiptTextIcon,
  RulerIcon,
  SettingsIcon,
  ShuffleIcon,
  TrendingUpIcon,
  TruckIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Role } from "@/generated/prisma/enums";
import { hasCapability } from "@/lib/auth/roles";
import { PROJECT_STATUS_LABELS } from "@/lib/labels";
import { COMPANY_MODULES, PROJECT_MODULES, projectModuleHref } from "@/lib/modules";
import { cn } from "@/lib/utils";
import type { ShellProject } from "./types";

const PROJECT_ICONS: Record<string, LucideIcon> = {
  "": GaugeIcon,
  expenses: ReceiptTextIcon,
  "cost-tree": ListTreeIcon,
  blocks: BlocksIcon,
  land: LandPlotIcon,
  quantities: RulerIcon,
  pricing: CalculatorIcon,
  sales: FileSignatureIcon,
  collections: HandCoinsIcon,
  "cash-flow": BanknoteIcon,
  scenarios: ShuffleIcon,
  reports: BarChart3Icon,
};

const COMPANY_ICONS: Record<string, LucideIcon> = {
  portfolio: LayoutGridIcon,
  projects: FolderKanbanIcon,
  connections: HandshakeIcon,
  suppliers: TruckIcon,
  library: BookOpenIcon,
  reports: TrendingUpIcon,
  settings: SettingsIcon,
};

function NavLink({
  href,
  icon: Icon,
  label,
  active,
  phase,
  onNavigate,
}: {
  href: string;
  icon: LucideIcon;
  label: string;
  active: boolean;
  phase?: number;
  onNavigate?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex min-h-10 items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors md:min-h-0 md:py-1.5",
        active
          ? "bg-primary/10 font-medium text-primary"
          : "text-foreground/80 hover:bg-accent hover:text-foreground",
        phase && !active && "text-muted-foreground",
      )}
    >
      <Icon className="size-4 shrink-0" />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {phase && (
        <Badge variant="soon" className="px-1.5 text-[10px]" title={`Faz ${phase}'de gelecek`}>
          Yakında
        </Badge>
      )}
    </Link>
  );
}

/**
 * Sol menü: seçili projenin modülleri, altında şirket geneli ekranlar (PLAN.md Bölüm 5.1).
 */
export function SideNav({
  projects,
  projectRoles,
  onNavigate,
}: {
  projects: ShellProject[];
  projectRoles: Record<string, Role>;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const { projectId } = useParams<{ projectId?: string }>();
  const project = projectId ? projects.find((p) => p.id === projectId) : undefined;
  const role = project ? projectRoles[project.id] : null;

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
              {PROJECT_MODULES.filter(
                (module) => !module.capability || hasCapability(role, module.capability),
              ).map((module) => {
                const href = projectModuleHref(project.id, module.key);
                const active = module.key ? pathname.startsWith(href) : pathname === href;
                return (
                  <NavLink
                    key={module.key || "panel"}
                    href={href}
                    icon={PROJECT_ICONS[module.key] ?? GaugeIcon}
                    label={module.label}
                    phase={module.phase}
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
          {COMPANY_MODULES.map((module) => (
            <NavLink
              key={module.key}
              href={module.href}
              icon={COMPANY_ICONS[module.key] ?? SettingsIcon}
              label={module.label}
              phase={module.phase}
              active={
                module.href === "/projects"
                  ? pathname === "/projects"
                  : pathname.startsWith(module.href)
              }
              onNavigate={onNavigate}
            />
          ))}
        </nav>
      </section>
    </div>
  );
}
