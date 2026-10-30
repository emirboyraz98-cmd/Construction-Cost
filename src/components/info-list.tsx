import type { ReactNode } from "react";

export function InfoList({ items }: { items: { label: string; value: ReactNode; hint?: string }[] }) {
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => (
        <div key={item.label} className="min-w-0">
          <dt className="text-xs text-muted-foreground">{item.label}</dt>
          <dd className="truncate font-medium">{item.value ?? "—"}</dd>
          {item.hint && <dd className="text-[11px] text-muted-foreground">{item.hint}</dd>}
        </div>
      ))}
    </dl>
  );
}
