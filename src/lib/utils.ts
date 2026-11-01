import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Türkçe büyük/küçük harfe duyarsız arama için (İ/ı, Ş/ş …). */
export function normalizeForSearch(text: string): string {
  return text.toLocaleLowerCase("tr-TR").normalize("NFC");
}
