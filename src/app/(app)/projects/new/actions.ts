"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionResult } from "@/lib/action-result";
import { fieldErrors } from "@/lib/validation/fields";
import { createProjectSchema, type CreateProjectInput } from "@/lib/validation/project";
import { requireGlobalCapability } from "@/server/access";
import { toActionResult } from "@/server/action-error";
import { createProject } from "@/server/projects";

export async function createProjectAction(input: CreateProjectInput): Promise<ActionResult> {
  let projectId: string;
  try {
    const access = await requireGlobalCapability("project.create");
    const parsed = createProjectSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: "Formdaki hataları düzeltin.", fieldErrors: fieldErrors(parsed.error) };
    }
    projectId = (await createProject(access, parsed.data)).id;
  } catch (error) {
    return toActionResult(error);
  }
  revalidatePath("/", "layout");
  // Proje oluşturulurken sekmesi de açıldı; yeni sekmede proje paneline geçilir.
  redirect(`/projects/${projectId}`);
}
