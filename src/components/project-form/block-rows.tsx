"use client";

import { PlusIcon, Trash2Icon } from "lucide-react";
import { FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ProjectType } from "@/generated/prisma/enums";

export type BlockRowValues = {
  key: string;
  name: string;
  floorCount: string;
  basementCount: string;
  constructionArea: string;
};

/** Sıradaki blok adı önerisi: "A Blok", "B Blok" … (villa projelerinde "Villa 1", "Villa 2" …). */
export function suggestBlockName(existing: readonly string[], type: ProjectType | ""): string {
  const used = new Set(existing.map((name) => name.trim().toLocaleLowerCase("tr-TR")));
  if (type !== "VILLA") {
    for (const letter of "ABCÇDEFGHIİJKLMNOÖPRSŞTUÜVYZ") {
      const name = `${letter} Blok`;
      if (!used.has(name.toLocaleLowerCase("tr-TR"))) return name;
    }
  }
  const prefix = type === "VILLA" ? "Villa" : "Blok";
  for (let n = 1; ; n++) {
    const name = `${prefix} ${n}`;
    if (!used.has(name.toLocaleLowerCase("tr-TR"))) return name;
  }
}

let rowCounter = 0;
export function newBlockRow(name: string, values: Partial<BlockRowValues> = {}): BlockRowValues {
  rowCounter += 1;
  return {
    key: `blok-${rowCounter}`,
    name,
    floorCount: "",
    basementCount: "",
    constructionArea: "",
    ...values,
  };
}

/** Sihirbazdaki blok satırları: ad, kat, bodrum, inşaat alanı. */
export function BlockRows({
  rows,
  errors,
  projectType,
  onChange,
}: {
  rows: BlockRowValues[];
  errors: Record<string, string>;
  projectType: ProjectType | "";
  onChange: (rows: BlockRowValues[]) => void;
}) {
  const update = (index: number, patch: Partial<BlockRowValues>) =>
    onChange(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));

  return (
    <div className="grid gap-3">
      {rows.map((row, index) => {
        const error = (field: string) => errors[`blocks.${index}.${field}`];
        return (
          <div key={row.key} className="grid gap-3 rounded-lg border p-3 sm:grid-cols-[2fr_1fr_1fr_1.5fr_auto] sm:items-start">
            <FormField id={`${row.key}-name`} label="Blok adı" required error={error("name")}>
              <Input
                id={`${row.key}-name`}
                value={row.name}
                onChange={(e) => update(index, { name: e.target.value })}
                maxLength={60}
                aria-invalid={error("name") ? true : undefined}
              />
            </FormField>
            <div className="grid grid-cols-3 gap-3 sm:contents">
              <FormField id={`${row.key}-floors`} label="Kat" error={error("floorCount")}>
                <Input
                  id={`${row.key}-floors`}
                  value={row.floorCount}
                  onChange={(e) => update(index, { floorCount: e.target.value })}
                  inputMode="numeric"
                  aria-invalid={error("floorCount") ? true : undefined}
                />
              </FormField>
              <FormField id={`${row.key}-basements`} label="Bodrum" error={error("basementCount")}>
                <Input
                  id={`${row.key}-basements`}
                  value={row.basementCount}
                  onChange={(e) => update(index, { basementCount: e.target.value })}
                  inputMode="numeric"
                  aria-invalid={error("basementCount") ? true : undefined}
                />
              </FormField>
              <FormField id={`${row.key}-area`} label="İnşaat alanı (m²)" error={error("constructionArea")}>
                <Input
                  id={`${row.key}-area`}
                  value={row.constructionArea}
                  onChange={(e) => update(index, { constructionArea: e.target.value })}
                  inputMode="decimal"
                  aria-invalid={error("constructionArea") ? true : undefined}
                />
              </FormField>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="justify-self-end sm:mt-6"
              disabled={rows.length === 1}
              onClick={() => onChange(rows.filter((_, i) => i !== index))}
              aria-label={`${row.name || "Bloğu"} sil`}
            >
              <Trash2Icon />
            </Button>
          </div>
        );
      })}
      <Button
        type="button"
        variant="outline"
        className="justify-self-start"
        onClick={() =>
          onChange([
            ...rows,
            newBlockRow(suggestBlockName(rows.map((row) => row.name), projectType)),
          ])
        }
      >
        <PlusIcon />
        Blok ekle
      </Button>
    </div>
  );
}
