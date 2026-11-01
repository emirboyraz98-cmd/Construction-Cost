import type { ReactNode } from "react";
import { InfoTip } from "@/components/info-tip";
import { glossaryEntry } from "@/lib/glossary";

export function PageHeader({
  title,
  description,
  actions,
  children,
  info,
}: {
  title: ReactNode;
  /** Sözlük anahtarı; verilmezse başlık yazısıyla aranır. false: ⓘ gösterme. */
  info?: string | false;
  description?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
}) {
  const label = info === false ? null : (info ?? (typeof title === "string" ? title : null));
  const entry = glossaryEntry(label);
  return (
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight md:text-2xl">
          {title}
          {entry && <InfoTip entry={entry} title={label ?? undefined} className="ml-2 size-5 [&_svg]:size-4" />}
        </h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
        {children}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
