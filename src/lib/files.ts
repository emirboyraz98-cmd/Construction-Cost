// Yüklenen dosyanın gerçek türünü ilk baytlarından anlar (uzantıya/tarayıcıya güvenilmez).

export const ALLOWED_UPLOADS = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/heic": ".heic",
  "application/pdf": ".pdf",
} as const;

export type AllowedMime = keyof typeof ALLOWED_UPLOADS;

export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;

export function detectFileType(bytes: Uint8Array): AllowedMime | null {
  const ascii = (start: number, end: number) => String.fromCharCode(...bytes.subarray(start, end));
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes[0] === 0x89 && ascii(1, 4) === "PNG") return "image/png";
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "image/webp";
  if (ascii(4, 8) === "ftyp" && ["heic", "heix", "mif1", "msf1", "hevc"].includes(ascii(8, 12))) return "image/heic";
  if (ascii(0, 5) === "%PDF-") return "application/pdf";
  return null;
}
