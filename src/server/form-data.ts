import "server-only";
import { z } from "zod";

const removeSchema = z.array(z.string().min(1).max(100)).max(50);

/** `toFormData` ile gönderilen formu okur. */
export function readFormData(formData: FormData) {
  const payload: unknown = JSON.parse(String(formData.get("payload") ?? "{}"));
  const files = formData.getAll("files").filter((f): f is File => f instanceof File);
  const removeDocuments = removeSchema.parse(JSON.parse(String(formData.get("removeDocuments") ?? "[]")));
  return { payload, files, removeDocuments };
}
