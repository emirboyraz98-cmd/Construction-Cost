import "server-only";
import { detectFileType, MAX_UPLOAD_BYTES } from "@/lib/files";
import { ActionError } from "./access";
import { db } from "./db";
import { deleteStoredFile, saveFile } from "./storage";

// Belge yükleme: harcama, bağlantı, bağlantı faturası, sözleşme ve hakediş ekranları ortak kullanır.

export const MAX_FILES = 10;

export type SavedFile = { key: string; fileName: string; mimeType: string; size: number };

export async function storeFiles(files: File[]): Promise<SavedFile[]> {
  if (files.length > MAX_FILES) throw new ActionError(`En fazla ${MAX_FILES} belge eklenebilir.`);
  const saved: SavedFile[] = [];
  try {
    for (const file of files) {
      if (file.size === 0) continue;
      if (file.size > MAX_UPLOAD_BYTES) throw new ActionError(`“${file.name}” çok büyük (en fazla 15 MB).`);
      const bytes = new Uint8Array(await file.arrayBuffer());
      const mimeType = detectFileType(bytes);
      if (!mimeType) throw new ActionError(`“${file.name}” desteklenmeyen dosya türü (fotoğraf veya PDF olmalı).`);
      const key = await saveFile(bytes, mimeType);
      saved.push({ key, fileName: file.name.slice(0, 200) || "belge", mimeType, size: bytes.byteLength });
    }
  } catch (error) {
    await Promise.all(saved.map((file) => deleteStoredFile(file.key)));
    throw error;
  }
  return saved;
}

/** Kaldırılan belgenin dosyasını, başka bir kayıt (bölünmüş fatura) kullanmıyorsa diskten siler. */
export async function removeOrphanFiles(keys: string[]) {
  for (const key of new Set(keys)) {
    if ((await db.document.count({ where: { storageKey: key } })) === 0) await deleteStoredFile(key);
  }
}


/** Kaydedilen dosyalardan Document satırları (ilişki alanı çağıran tarafta verilir). */
export function documentRows(saved: SavedFile[], userId: string) {
  return saved.map((file) => ({
    fileName: file.fileName,
    mimeType: file.mimeType,
    size: file.size,
    storageKey: file.key,
    uploadedById: userId,
  }));
}

/** İşlem başarısız olursa yeni yüklenen dosyaları geri al. */
export async function discardFiles(saved: SavedFile[]) {
  await Promise.all(saved.map((file) => deleteStoredFile(file.key)));
}
