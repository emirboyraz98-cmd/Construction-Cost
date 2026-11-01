import type { ProjectStatus, Role } from "@/generated/prisma/enums";

export type ShellProject = { id: string; name: string; status: ProjectStatus };
export type ShellTab = { projectId: string; name: string };
export type ShellUser = { name: string; email: string; role: Role };
