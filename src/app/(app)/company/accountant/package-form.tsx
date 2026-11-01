"use client";

import { useState } from "react";
import { DownloadIcon } from "lucide-react";
import { FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function monthRange(offset: number, now: Date) {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offset, 1));
  const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0));
  return { from: start.toISOString().slice(0, 10), to: end.toISOString().slice(0, 10) };
}

export function PackageForm({ projects, today }: { projects: { id: string; name: string }[]; today: string }) {
  const now = new Date(`${today}T00:00:00Z`);
  const [range, setRange] = useState(() => monthRange(-1, now));
  const [selected, setSelected] = useState<Set<string>>(new Set(projects.map((p) => p.id)));
  const params = new URLSearchParams({ from: range.from, to: range.to });
  if (selected.size !== projects.length) params.set("projects", [...selected].join(","));

  return (
    <Card className="max-w-2xl">
      <CardContent className="grid gap-4">
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => setRange(monthRange(-1, now))}>
            Geçen ay
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => setRange(monthRange(0, now))}>
            Bu ay
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <FormField id="from" label="Başlangıç">
            <Input id="from" type="date" value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} />
          </FormField>
          <FormField id="to" label="Bitiş">
            <Input id="to" type="date" value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} />
          </FormField>
        </div>
        <fieldset className="grid gap-2">
          <legend className="mb-1 text-sm font-medium">Projeler</legend>
          {projects.map((project) => (
            <Label key={project.id} className="font-normal">
              <Checkbox
                checked={selected.has(project.id)}
                onCheckedChange={(on) =>
                  setSelected((current) => {
                    const next = new Set(current);
                    if (on === true) next.add(project.id);
                    else next.delete(project.id);
                    return next;
                  })
                }
              />
              {project.name}
            </Label>
          ))}
        </fieldset>
        {selected.size === 0 ? (
          <Button size="lg" className="justify-self-start" disabled>
            <DownloadIcon />
            Paketi indir (ZIP)
          </Button>
        ) : (
          <Button asChild size="lg" className="justify-self-start">
            <a href={`/api/exports/accountant?${params.toString()}`}>
              <DownloadIcon />
              Paketi indir (ZIP)
            </a>
          </Button>
        )}
        <p className="text-xs text-muted-foreground">
          Yalnızca onaylanmış kayıtlar girer. Seçilen dönemde kayıt yoksa indirme yerine uyarı görünür.
        </p>
      </CardContent>
    </Card>
  );
}
