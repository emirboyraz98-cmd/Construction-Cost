"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CameraIcon, FileTextIcon, LoaderCircleIcon, PaperclipIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

const MAX_SIDE = 1800;
const JPEG_QUALITY = 0.8;

/**
 * Telefon fotoğrafları (3–8 MB) yüklemeden önce tarayıcıda küçültülür (~300 KB);
 * şantiyedeki zayıf internette hızlı yüklenir. Küçültülemeyen dosya olduğu gibi gönderilir.
 */
async function compressImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || file.type === "image/gif") return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" });
  } catch {
    return file;
  }
}

type Picked = { file: File; url: string | null };

export function FilePicker({ files, onChange }: { files: File[]; onChange: (files: File[]) => void }) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const previews = useMemo<Picked[]>(
    () => files.map((file) => ({ file, url: file.type.startsWith("image/") ? URL.createObjectURL(file) : null })),
    [files],
  );
  useEffect(() => () => previews.forEach((p) => p.url && URL.revokeObjectURL(p.url)), [previews]);

  async function add(list: FileList | null) {
    if (!list?.length) return;
    setBusy(true);
    const processed = await Promise.all([...list].map(compressImage));
    setBusy(false);
    onChange([...files, ...processed].slice(0, 10));
  }

  return (
    <div className="grid gap-2">
      <div className="grid grid-cols-2 gap-2">
        <Button type="button" variant="outline" size="lg" onClick={() => cameraRef.current?.click()} disabled={busy}>
          {busy ? <LoaderCircleIcon className="animate-spin" /> : <CameraIcon />}
          Fotoğraf çek
        </Button>
        <Button type="button" variant="outline" size="lg" onClick={() => fileRef.current?.click()} disabled={busy}>
          <PaperclipIcon />
          Dosya seç
        </Button>
      </div>
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          void add(e.target.files);
          e.target.value = "";
        }}
      />
      <input
        ref={fileRef}
        type="file"
        accept="image/*,application/pdf"
        multiple
        className="hidden"
        onChange={(e) => {
          void add(e.target.files);
          e.target.value = "";
        }}
      />
      {previews.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {previews.map((preview, index) => (
            <li key={`${preview.file.name}-${index}`} className="relative">
              {preview.url ? (
                // eslint-disable-next-line @next/next/no-img-element -- yerel önizleme (blob adresi)
                <img src={preview.url} alt={preview.file.name} className="size-20 rounded-md border object-cover" />
              ) : (
                <div className="flex size-20 flex-col items-center justify-center gap-1 rounded-md border bg-muted p-1 text-center text-[10px]">
                  <FileTextIcon className="size-5" />
                  <span className="line-clamp-2 break-all">{preview.file.name}</span>
                </div>
              )}
              <button
                type="button"
                className="absolute -top-2 -right-2 rounded-full border bg-background p-1 shadow"
                onClick={() => onChange(files.filter((_, i) => i !== index))}
                aria-label={`${preview.file.name} kaldır`}
              >
                <XIcon className="size-3" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
