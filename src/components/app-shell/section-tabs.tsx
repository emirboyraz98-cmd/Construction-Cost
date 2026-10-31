"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Role } from "@/generated/prisma/enums";
import { COMPANY_SECTIONS, companyKey, PROJECT_SECTIONS, projectModuleHref, projectSegment, visibleTabs } from "@/lib/modules";
import { cn } from "@/lib/utils";
import { canSeeCompanyModule, canSeeProjectModule, companyHref } from "./side-nav";

/** Bölümün alt ekranları: sayfanın üstünde sekme çubuğu (tek ekranlı bölümde gösterilmez). */
export function SectionTabs({ projectRoles, userRole, advanced }: { projectRoles: Record<string, Role>; userRole: Role; advanced: boolean }) {
  const pathname = usePathname();
  const seg = projectSegment(pathname);
  let items: { key: string; label: string; href: string }[] = [];
  let activeKey: string | null = null;

  if (seg) {
    const role = projectRoles[seg.projectId];
    const section = PROJECT_SECTIONS.find((s) => s.tabs.some((t) => t.key === seg.key));
    if (section) {
      activeKey = seg.key;
      items = visibleTabs(section, (k) => canSeeProjectModule(role, k), advanced, seg.key).map((t) => ({ ...t, href: projectModuleHref(seg.projectId, t.key) }));
    }
  } else {
    const key = companyKey(pathname);
    const section = key ? COMPANY_SECTIONS.find((s) => s.tabs.some((t) => t.key === key)) : undefined;
    if (section && key) {
      activeKey = key;
      items = visibleTabs(section, (k) => canSeeCompanyModule(userRole, k), advanced, key).map((t) => ({ ...t, href: companyHref(t.key) }));
    }
  }
  if (items.length < 2) return null;

  return (
    <nav aria-label="Bölüm sekmeleri" className="-mt-1 mb-5 overflow-x-auto border-b print:hidden">
      <ul className="flex min-w-max gap-1">
        {items.map((t) => {
          const active = t.key === activeKey;
          return (
            <li key={t.key || "panel"}>
              <Link
                href={t.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "-mb-px inline-flex min-h-10 items-center border-b-2 px-3 text-sm whitespace-nowrap transition-colors",
                  active ? "border-primary font-medium text-primary" : "border-transparent text-muted-foreground hover:border-border hover:text-foreground",
                )}
              >
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
