import { AlertTriangleIcon, FileTextIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { ConnectionStatus, ContractStatus, ProgressBillingStatus } from "@/generated/prisma/enums";
import type { ConnectionAlert } from "@/lib/connections/alerts";
import { BILLING_STATUS_LABELS, CONNECTION_STATUS_LABELS, CONTRACT_STATUS_LABELS } from "@/lib/connections/labels";
import { cn } from "@/lib/utils";

const STATUS_STYLES = {
  DRAFT: "border-slate-300 bg-slate-50 text-slate-700",
  ACTIVE: "border-emerald-300 bg-emerald-50 text-emerald-800",
  PENDING: "border-amber-300 bg-amber-50 text-amber-800",
  APPROVED: "border-emerald-300 bg-emerald-50 text-emerald-800",
  COMPLETED: "border-sky-300 bg-sky-50 text-sky-800",
  CANCELLED: "border-red-300 bg-red-50 text-red-700",
} as const;

export function ConnectionStatusBadge({ status }: { status: ConnectionStatus }) {
  return (
    <Badge variant="outline" className={STATUS_STYLES[status]}>
      {CONNECTION_STATUS_LABELS[status]}
    </Badge>
  );
}

export function ContractStatusBadge({ status }: { status: ContractStatus }) {
  return (
    <Badge variant="outline" className={STATUS_STYLES[status]}>
      {CONTRACT_STATUS_LABELS[status]}
    </Badge>
  );
}

export function BillingStatusBadge({ status }: { status: ProgressBillingStatus }) {
  return (
    <Badge variant="outline" className={STATUS_STYLES[status]}>
      {BILLING_STATUS_LABELS[status]}
    </Badge>
  );
}

export function AlertList({ alerts, className }: { alerts: ConnectionAlert[]; className?: string }) {
  if (alerts.length === 0) return null;
  return (
    <ul className={cn("grid gap-1 text-sm", className)}>
      {alerts.map((alert, i) => (
        <li key={i} className={cn("flex items-start gap-1.5", alert.level === "danger" ? "text-destructive" : "text-amber-800")}>
          <AlertTriangleIcon className="mt-0.5 size-3.5 shrink-0" />
          {alert.message}
        </li>
      ))}
    </ul>
  );
}

/** Oran çubuğu (ör. çekilen / toplam). */
export function Meter({ value, className }: { value: number; className?: string }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <span className={cn("block h-1.5 w-full overflow-hidden rounded-full bg-muted", className)} aria-hidden>
      <span className="block h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
    </span>
  );
}

export function DocumentGallery({ documents }: { documents: { id: string; fileName: string; mimeType: string }[] }) {
  if (documents.length === 0) return <p className="text-sm text-muted-foreground">Belge eklenmemiş.</p>;
  return (
    <ul className="grid grid-cols-3 gap-3 sm:grid-cols-5">
      {documents.map((doc) => (
        <li key={doc.id}>
          <a href={`/api/documents/${doc.id}`} target="_blank" rel="noreferrer" className="block">
            {doc.mimeType.startsWith("image/") ? (
              // eslint-disable-next-line @next/next/no-img-element -- yetki kontrollü belge adresi
              <img src={`/api/documents/${doc.id}`} alt={doc.fileName} className="aspect-[3/4] w-full rounded-md border object-cover" />
            ) : (
              <span className="flex aspect-[3/4] w-full flex-col items-center justify-center gap-2 rounded-md border bg-muted text-sm">
                <FileTextIcon className="size-8" />
                PDF
              </span>
            )}
            <span className="mt-1 block truncate text-xs text-muted-foreground">{doc.fileName}</span>
          </a>
        </li>
      ))}
    </ul>
  );
}

export function NoAccess({ text }: { text: string }) {
  return <p className="max-w-xl rounded-xl border bg-card p-5 text-sm text-muted-foreground">{text}</p>;
}

/** Özet rakam (biçimlendirilmiş metin). */
export function Figure({ label, value, note, tone }: { label: string; value: string; note?: string; tone?: "warn" | "danger" }) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn("font-medium tabular-nums [overflow-wrap:anywhere]", tone === "warn" && "text-amber-700", tone === "danger" && "text-destructive")}>{value}</p>
      {note && <p className="text-[11px] text-muted-foreground">{note}</p>}
    </div>
  );
}
