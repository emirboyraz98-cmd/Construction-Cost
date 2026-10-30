"use client";

import { useParams, usePathname, useRouter } from "next/navigation";
import { NativeSelect } from "@/components/ui/native-select";
import type { ShellProject, ShellTab } from "./types";

/** Mobilde sekmeler yerine üstte proje seçici. */
export function ProjectPicker({
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
  const { projectId } = useParams<{ projectId?: string }>();

  const openIds = new Set(tabs.map((tab) => tab.projectId));
  const openProjects = tabs.filter((tab) => projects.some((p) => p.id === tab.projectId));
  const otherProjects = projects.filter((project) => !openIds.has(project.id));

  const value = projectId
    ? projectId
    : pathname.startsWith("/portfolio")
      ? "portfolio"
      : pathname === "/projects/new"
        ? "new"
        : "";

  function select(next: string) {
    if (next === "portfolio") router.push("/portfolio");
    else if (next === "new") router.push("/projects/new");
    else if (next === "all") router.push("/projects");
    else if (next) router.push(`/projects/${next}`);
  }

  return (
    <NativeSelect
      aria-label="Proje seç"
      value={value}
      onChange={(event) => select(event.target.value)}
      className="min-w-0 flex-1"
    >
      <option value="" disabled>
        Proje seçin…
      </option>
      <option value="portfolio">Portföy (tüm projeler)</option>
      {openProjects.length > 0 && (
        <optgroup label="Açık sekmeler">
          {openProjects.map((tab) => (
            <option key={tab.projectId} value={tab.projectId}>
              {tab.name}
            </option>
          ))}
        </optgroup>
      )}
      {otherProjects.length > 0 && (
        <optgroup label="Diğer projeler">
          {otherProjects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </optgroup>
      )}
      <option value="all">Proje listesi…</option>
      {canCreateProject && <option value="new">+ Yeni proje</option>}
    </NativeSelect>
  );
}
