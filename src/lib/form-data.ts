// Dosyalı formlar Server Action'a FormData ile gider: JSON "payload" + "files" (+ silinecek belgeler).
export function toFormData(payload: unknown, files: File[] = [], removeDocuments: string[] = []): FormData {
  const formData = new FormData();
  formData.set("payload", JSON.stringify(payload));
  for (const file of files) formData.append("files", file);
  if (removeDocuments.length) formData.set("removeDocuments", JSON.stringify(removeDocuments));
  return formData;
}
