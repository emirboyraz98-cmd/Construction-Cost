import "server-only";
import { unstable_rethrow } from "next/navigation";
import { z } from "zod";
import type { ActionFailure } from "@/lib/action-result";
import { fieldErrors } from "@/lib/validation/fields";
import { Prisma } from "@/generated/prisma/client";
import { ActionError } from "./access";

/** Server Action içindeki hatayı kullanıcıya gösterilecek sonuca çevirir. */
export function toActionResult(error: unknown): ActionFailure {
  unstable_rethrow(error); // redirect() / notFound() Next.js'e geri verilir
  if (error instanceof ActionError) return { ok: false, error: error.message };
  if (error instanceof z.ZodError) {
    return { ok: false, error: "Formdaki hataları düzeltin.", fieldErrors: fieldErrors(error) };
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    return { ok: false, error: "Bu kayıt zaten var (aynı ad veya kod kullanılıyor)." };
  }
  console.error(error);
  return { ok: false, error: "Beklenmeyen bir hata oluştu. Tekrar deneyin." };
}
