import Link from "next/link";
import { FLOOR_LABEL } from "@/lib/budget/labels";
import { cn } from "@/lib/utils";

export type PlanCell = {
  id: string;
  doorNo: string;
  lines: string[];
  tone: string;
  href?: string;
  title?: string;
};

export type PlanBlock = { id: string; name: string; floors: { floor: number; cells: PlanCell[] }[] };

/** Bölümleri blok blok, üst kattan alta doğru gösterir (PLAN.md 11: kat planı görünümü). */
export function FloorPlan({ blocks, legend }: { blocks: PlanBlock[]; legend: { label: string; tone: string; count?: number }[] }) {
  return (
    <div className="grid grid-cols-1 gap-4">
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground" aria-label="Lejant">
        {legend.map((l) => (
          <li key={l.label} className="flex items-center gap-1.5">
            <span className={cn("size-3 rounded-sm border", l.tone)} />
            {l.label}
            {l.count != null && <span className="tabular-nums">({l.count})</span>}
          </li>
        ))}
      </ul>
      {blocks.map((b) => (
        <section key={b.id} className="grid grid-cols-1 gap-2">
          <h3 className="font-medium">{b.name}</h3>
          <div className="overflow-x-auto rounded-xl border bg-card p-3">
            <div className="grid min-w-fit gap-1.5">
              {b.floors.map((f) => (
                <div key={f.floor} className="flex items-stretch gap-1.5">
                  <span className="flex w-16 shrink-0 items-center text-xs text-muted-foreground">{FLOOR_LABEL(f.floor)}</span>
                  {f.cells.map((c) => {
                    const body = (
                      <>
                        <span className="block text-sm font-semibold">{c.doorNo}</span>
                        {c.lines.map((line, i) => (
                          <span key={i} className="block truncate text-[11px] leading-tight">
                            {line}
                          </span>
                        ))}
                      </>
                    );
                    const cls = cn("block w-32 shrink-0 rounded-md border p-1.5 text-left", c.tone, c.href && "transition-shadow hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none");
                    return c.href ? (
                      <Link key={c.id} href={c.href} className={cls} title={c.title}>
                        {body}
                      </Link>
                    ) : (
                      <div key={c.id} className={cls} title={c.title}>
                        {body}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </section>
      ))}
    </div>
  );
}

/** Bölümleri bloklara ve katlara (yukarıdan aşağı) gruplar. */
export function groupPlan<T extends { id: string; floor: number; doorNo: string; block: { id: string; name: string; sortOrder: number } }>(units: T[], cell: (u: T) => Omit<PlanCell, "id" | "doorNo">): PlanBlock[] {
  const blocks = new Map<string, { block: T["block"]; units: T[] }>();
  for (const u of units) (blocks.get(u.block.id) ?? blocks.set(u.block.id, { block: u.block, units: [] }).get(u.block.id)!).units.push(u);
  return [...blocks.values()]
    .sort((a, b) => a.block.sortOrder - b.block.sortOrder || a.block.name.localeCompare(b.block.name, "tr"))
    .map(({ block, units: list }) => {
      const floors = [...new Set(list.map((u) => u.floor))].sort((a, b) => b - a);
      return {
        id: block.id,
        name: block.name,
        floors: floors.map((floor) => ({
          floor,
          cells: list
            .filter((u) => u.floor === floor)
            .sort((a, b) => a.doorNo.localeCompare(b.doorNo, "tr", { numeric: true }))
            .map((u) => ({ id: u.id, doorNo: u.doorNo, ...cell(u) })),
        })),
      };
    });
}
