"use client";

import Link from "next/link";
import { useParams, usePathname, useRouter } from "next/navigation";
import { useEffect, useOptimistic, useRef, useTransition, type DragEvent, type MouseEvent } from "react";
import { LayoutGridIcon, PlusIcon, XIcon } from "lucide-react";
import { closeTabAction, moveTabAction, openTabAction } from "@/app/(app)/actions";
import { closeTab, moveTab, openTab, tabAfterClose, type Tab } from "@/lib/tabs";
import { cn } from "@/lib/utils";
import type { ShellProject, ShellTab } from "./types";

type TabUpdate =
  | { type: "open"; projectId: string }
  | { type: "close"; projectId: string }
  | { type: "move"; projectId: string; toIndex: number };

function applyTabUpdate(tabs: Tab[], update: TabUpdate): Tab[] {
  if (update.type === "open") return openTab(tabs, update.projectId);
  if (update.type === "close") return closeTab(tabs, update.projectId);
  return moveTab(tabs, update.projectId, update.toIndex);
}

const projectHome = (projectId: string) => `/projects/${projectId}`;

/**
 * Masaüstü üst çubuk: [Portföy] [Proje A ×] [Proje B ×] [+ Yeni proje].
 * Sekmeler kullanıcı bazında veritabanında tutulur; açılan her proje sekmeye eklenir.
 */
export function TabBar({
  tabs,
  projects,
  canCreateProject,
}: {
  tabs: ShellTab[];
  projects: ShellProject[];
  canCreateProject: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { projectId: currentProjectId } = useParams<{ projectId?: string }>();
  const [, startTransition] = useTransition();

  const savedTabs = tabs.map((tab, index) => ({ projectId: tab.projectId, position: index }));
  const [optimisticTabs, updateTabs] = useOptimistic(savedTabs, applyTabUpdate);

  const names = new Map(projects.map((project) => [project.id, project.name]));
  for (const tab of tabs) names.set(tab.projectId, tab.name);

  // Bir projeye girildiğinde (link, adres çubuğu, yeni proje) sekmesi yoksa açılır.
  const registered = useRef<string | null>(null);
  useEffect(() => {
    if (!currentProjectId || registered.current === currentProjectId) return;
    registered.current = currentProjectId;
    const isOpen = tabs.some((tab) => tab.projectId === currentProjectId);
    const isVisible = projects.some((project) => project.id === currentProjectId);
    if (!isOpen && isVisible) {
      startTransition(async () => {
        updateTabs({ type: "open", projectId: currentProjectId });
        await openTabAction(currentProjectId);
      });
    }
  }, [currentProjectId, tabs, projects, updateTabs]);

  // Her sekmenin en son bakılan ekranı hatırlanır (tarayıcı sekmesi gibi).
  const lastPaths = useRef(new Map<string, string>());
  useEffect(() => {
    if (currentProjectId) lastPaths.current.set(currentProjectId, pathname);
  }, [currentProjectId, pathname]);

  const shownTabs = optimisticTabs.filter((tab) => names.has(tab.projectId));
  const showUnsavedCurrent =
    currentProjectId &&
    names.has(currentProjectId) &&
    !shownTabs.some((tab) => tab.projectId === currentProjectId);

  function goToTab(event: MouseEvent, projectId: string) {
    const last = lastPaths.current.get(projectId);
    if (last && last !== projectHome(projectId)) {
      event.preventDefault();
      router.push(last);
    }
  }

  function close(projectId: string) {
    const isActive = projectId === currentProjectId;
    const next = isActive ? tabAfterClose(shownTabs, projectId) : null;
    startTransition(async () => {
      updateTabs({ type: "close", projectId });
      if (isActive) router.push(next ? (lastPaths.current.get(next) ?? projectHome(next)) : "/portfolio");
      lastPaths.current.delete(projectId);
      await closeTabAction(projectId);
    });
  }

  const dragging = useRef<string | null>(null);
  function drop(event: DragEvent, targetProjectId: string) {
    event.preventDefault();
    const source = dragging.current;
    dragging.current = null;
    if (!source || source === targetProjectId) return;
    const toIndex = shownTabs.findIndex((tab) => tab.projectId === targetProjectId);
    startTransition(async () => {
      updateTabs({ type: "move", projectId: source, toIndex });
      await moveTabAction(source, toIndex);
    });
  }

  const tabClass = (active: boolean) =>
    cn(
      "group flex h-9 shrink-0 items-center rounded-t-lg border border-b-0 text-sm transition-colors",
      active
        ? "border-border bg-background font-medium text-foreground"
        : "border-transparent text-muted-foreground hover:bg-background/60 hover:text-foreground",
    );

  return (
    <nav aria-label="Proje sekmeleri" className="flex min-w-0 flex-1 items-end gap-1 overflow-x-auto pt-1.5">
      <Link
        href="/portfolio"
        className={cn(tabClass(pathname.startsWith("/portfolio")), "gap-2 px-3")}
      >
        <LayoutGridIcon className="size-4" />
        Portföy
      </Link>

      {shownTabs.map((tab) => {
        const active = tab.projectId === currentProjectId;
        const name = names.get(tab.projectId);
        return (
          <div
            key={tab.projectId}
            className={cn(tabClass(active), "max-w-60")}
            draggable
            onDragStart={(event) => {
              dragging.current = tab.projectId;
              event.dataTransfer.effectAllowed = "move";
            }}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => drop(event, tab.projectId)}
            onAuxClick={(event) => event.button === 1 && close(tab.projectId)}
            title={name}
          >
            <Link
              href={projectHome(tab.projectId)}
              onClick={(event) => goToTab(event, tab.projectId)}
              className="truncate py-2 pr-1 pl-3"
              aria-current={active ? "page" : undefined}
            >
              {name}
            </Link>
            <button
              type="button"
              onClick={() => close(tab.projectId)}
              className="mr-1.5 rounded p-0.5 text-muted-foreground opacity-60 hover:bg-muted hover:text-foreground group-hover:opacity-100"
              aria-label={`${name} sekmesini kapat`}
              title="Sekmeyi kapat (proje silinmez)"
            >
              <XIcon className="size-3.5" />
            </button>
          </div>
        );
      })}

      {showUnsavedCurrent && (
        <div className={cn(tabClass(true), "max-w-60 px-3")}>
          <span className="truncate">{names.get(currentProjectId)}</span>
        </div>
      )}

      {canCreateProject && (
        <Link
          href="/projects/new"
          className={cn(tabClass(pathname === "/projects/new"), "gap-1.5 px-3")}
        >
          <PlusIcon className="size-4" />
          Yeni proje
        </Link>
      )}
    </nav>
  );
}
