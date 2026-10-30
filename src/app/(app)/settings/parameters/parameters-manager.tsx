"use client";

import { useState, useTransition } from "react";
import { PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { FormError, FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatNumber } from "@/lib/format";
import { PARAMETER_KINDS, parameterKindLabel } from "@/lib/parameters";
import { deleteParameterAction, saveParameterAction } from "./actions";

export type ParameterRow = {
  id: string;
  year: number;
  municipality: string | null;
  kind: string;
  value: string;
  unit: string | null;
  description: string | null;
};

type FormState = { id: string | null; year: string; municipality: string; kind: string; value: string; unit: string; description: string };

export function ParametersManager({ rows, year }: { rows: ParameterRow[]; year: number }) {
  const [form, setForm] = useState<FormState | null>(null);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  const open = (row?: ParameterRow) =>
    setForm(
      row
        ? {
            id: row.id,
            year: String(row.year),
            municipality: row.municipality ?? "",
            kind: row.kind,
            value: row.value.replace(".", ","),
            unit: row.unit ?? "",
            description: row.description ?? "",
          }
        : { id: null, year: String(year), municipality: "", kind: "kdv_orani", value: "", unit: "%", description: "" },
    );

  return (
    <>
      <div className="mb-3 flex justify-end">
        <Button onClick={() => open()}>
          <PlusIcon />
          Parametre ekle
        </Button>
      </div>
      <Card className="py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4">Tür</TableHead>
              <TableHead>Yıl</TableHead>
              <TableHead>Belediye</TableHead>
              <TableHead className="text-right">Değer</TableHead>
              <TableHead>Açıklama</TableHead>
              <TableHead className="pr-4" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="pl-4">{parameterKindLabel(row.kind)}</TableCell>
                <TableCell>{row.year}</TableCell>
                <TableCell>{row.municipality ?? "Tümü"}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatNumber(row.value, 6)} {row.unit}
                </TableCell>
                <TableCell>{row.description}</TableCell>
                <TableCell className="pr-4 text-right">
                  <Button variant="ghost" size="icon-sm" onClick={() => open(row)} aria-label="Düzenle">
                    <PencilIcon />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Sil"
                    disabled={pending}
                    onClick={() => {
                      if (!confirm(`${parameterKindLabel(row.kind)} (${row.year}) silinsin mi?`)) return;
                      startTransition(async () => {
                        const result = await deleteParameterAction(row.id);
                        if (!result.ok) setError(result.error);
                      });
                    }}
                  >
                    <Trash2Icon />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-6 text-center text-muted-foreground">
                  Parametre yok.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
      {!form && <FormError message={error} />}

      <Dialog open={form !== null} onOpenChange={(o) => !o && setForm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{form?.id ? "Parametreyi düzenle" : "Parametre ekle"}</DialogTitle>
          </DialogHeader>
          <FormError message={error} />
          {form && (
            <div className="grid grid-cols-2 gap-3">
              <FormField id="kind" label="Tür" className="col-span-2">
                <NativeSelect
                  id="kind"
                  value={form.kind}
                  onChange={(e) => {
                    const kind = e.target.value;
                    setForm({ ...form, kind, unit: (PARAMETER_KINDS as Record<string, { unit: string }>)[kind]?.unit ?? form.unit });
                  }}
                >
                  {Object.entries(PARAMETER_KINDS).map(([kind, def]) => (
                    <option key={kind} value={kind}>
                      {def.label}
                    </option>
                  ))}
                  {!(form.kind in PARAMETER_KINDS) && <option value={form.kind}>{form.kind}</option>}
                </NativeSelect>
              </FormField>
              <FormField id="year" label="Yıl">
                <Input id="year" inputMode="numeric" value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} />
              </FormField>
              <FormField id="municipality" label="Belediye" hint="Boş: tüm belediyeler">
                <Input id="municipality" value={form.municipality} onChange={(e) => setForm({ ...form, municipality: e.target.value })} />
              </FormField>
              <FormField id="value" label="Değer">
                <Input id="value" inputMode="decimal" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} />
              </FormField>
              <FormField id="unit" label="Birim">
                <Input id="unit" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} />
              </FormField>
              <FormField id="description" label="Açıklama" className="col-span-2">
                <Input id="description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </FormField>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setForm(null)}>
              Vazgeç
            </Button>
            <Button
              disabled={pending}
              onClick={() =>
                form &&
                startTransition(async () => {
                  setError(undefined);
                  const { id, ...input } = form;
                  const result = await saveParameterAction(id, input);
                  if (!result.ok) setError(result.error);
                  else setForm(null);
                })
              }
            >
              Kaydet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
