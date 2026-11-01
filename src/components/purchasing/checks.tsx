import { AlertTriangleIcon, CheckCircle2Icon } from "lucide-react";
import { cn } from "@/lib/utils";

/** Kontrol listesi: kırmızı (hata), turuncu (uyarı), gri (bilgi). */
export function CheckList({ checks }: { checks: { level: "danger" | "warning" | "info"; message: string }[] }) {
  if (checks.length === 0) return null;
  return (
    <ul className="grid gap-1 text-sm">
      {checks.map((c, i) => (
        <li
          key={i}
          className={cn(
            "flex items-start gap-1.5",
            c.level === "danger" ? "text-destructive" : c.level === "warning" ? "text-amber-800" : "text-muted-foreground",
          )}
        >
          {c.level === "info" ? <CheckCircle2Icon className="mt-0.5 size-3.5 shrink-0" /> : <AlertTriangleIcon className="mt-0.5 size-3.5 shrink-0" />}
          {c.message}
        </li>
      ))}
    </ul>
  );
}
