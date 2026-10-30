"use client";

import { useState, useTransition } from "react";
import { LoaderCircleIcon, PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { FormError, FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatNumber } from "@/lib/format";
import type { BlockInput } from "@/lib/validation/project";
import { deleteBlockAction, saveBlockAction } from "../actions";

export type BlockRow = {
  id: string;
  name: string;
  floorCount: number | null;
  basementCount: number | null;
  floorHeight: string | null;
  constructionArea: string | null;
  elevatorCount: number | null;
};

const EMPTY: Required<BlockInput> = {
  name: "",
  floorCount: "",
  basementCount: "",
  floorHeight: "",
  constructionArea: "",
  elevatorCount: "",
};

function toForm(block: BlockRow): Required<BlockInput> {
  const text = (value: number | string | null) => (value == null ? "" : String(value).replace(".", ","));
  return {
    name: block.name,
    floorCount: text(block.floorCount),
    basementCount: text(block.basementCount),
    floorHeight: text(block.floorHeight),
    constructionArea: text(block.constructionArea),
    elevatorCount: text(block.elevatorCount),
  };
}

export function BlocksManager({
  projectId,
  blocks,
  canEdit,
}: {
  projectId: string;
  blocks: BlockRow[];
  canEdit: boolean;
}) {
  const [editing, setEditing] = useState<{ id: string | null; values: Required<BlockInput> } | null>(null);
  const [deleting, setDeleting] = useState<BlockRow | null>(null);

  return (
    <>
      {canEdit && (
        <div className="mb-3 flex justify-end">
          <Button onClick={() => setEditing({ id: null, values: EMPTY })}>
            <PlusIcon />
            Blok ekle
          </Button>
        </div>
      )}
      <Card className="py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4">Blok</TableHead>
              <TableHead className="text-right">Kat</TableHead>
              <TableHead className="text-right">Bodrum</TableHead>
              <TableHead className="text-right">Kat yüksekliği</TableHead>
              <TableHead className="text-right">İnşaat alanı</TableHead>
              <TableHead className="text-right">Asansör</TableHead>
              {canEdit && <TableHead className="pr-4" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {blocks.map((block) => (
              <TableRow key={block.id}>
                <TableCell className="pl-4 font-medium">{block.name}</TableCell>
                <TableCell className="text-right tabular-nums">{block.floorCount ?? "—"}</TableCell>
                <TableCell className="text-right tabular-nums">{block.basementCount ?? "—"}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {block.floorHeight ? `${formatNumber(block.floorHeight)} m` : "—"}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {block.constructionArea ? `${formatNumber(block.constructionArea)} m²` : "—"}
                </TableCell>
                <TableCell className="text-right tabular-nums">{block.elevatorCount ?? "—"}</TableCell>
                {canEdit && (
                  <TableCell className="pr-4 text-right">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => setEditing({ id: block.id, values: toForm(block) })}
                      aria-label={`${block.name} düzenle`}
                    >
                      <PencilIcon />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => setDeleting(block)}
                      disabled={blocks.length === 1}
                      aria-label={`${block.name} sil`}
                    >
                      <Trash2Icon />
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {editing && (
        <BlockDialog
          projectId={projectId}
          blockId={editing.id}
          initial={editing.values}
          onClose={() => setEditing(null)}
        />
      )}
      {deleting && <DeleteBlockDialog projectId={projectId} block={deleting} onClose={() => setDeleting(null)} />}
    </>
  );
}

function BlockDialog({
  projectId,
  blockId,
  initial,
  onClose,
}: {
  projectId: string;
  blockId: string | null;
  initial: Required<BlockInput>;
  onClose: () => void;
}) {
  const [values, setValues] = useState(initial);
  const [error, setError] = useState<string>();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();
  const field = (key: keyof BlockInput) => ({
    id: `block-${key}`,
    value: values[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setValues({ ...values, [key]: e.target.value }),
    "aria-invalid": errors[key] ? true : undefined,
  });

  function submit(event: React.FormEvent) {
    event.preventDefault();
    startTransition(async () => {
      const result = await saveBlockAction(projectId, blockId, values);
      if (result.ok) onClose();
      else {
        setError(result.error);
        setErrors(result.fieldErrors ?? {});
      }
    });
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <form onSubmit={submit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>{blockId ? "Bloğu düzenle" : "Blok ekle"}</DialogTitle>
            <DialogDescription>Villa projelerinde her villa bir bloktur.</DialogDescription>
          </DialogHeader>
          <FormError message={error} />
          <FormField id="block-name" label="Blok adı" required error={errors.name}>
            <Input {...field("name")} maxLength={60} autoFocus />
          </FormField>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <FormField id="block-floorCount" label="Kat sayısı" error={errors.floorCount}>
              <Input {...field("floorCount")} inputMode="numeric" />
            </FormField>
            <FormField id="block-basementCount" label="Bodrum sayısı" error={errors.basementCount}>
              <Input {...field("basementCount")} inputMode="numeric" />
            </FormField>
            <FormField id="block-floorHeight" label="Kat yüksekliği (m)" error={errors.floorHeight}>
              <Input {...field("floorHeight")} inputMode="decimal" placeholder="ör. 3,10" />
            </FormField>
            <FormField id="block-constructionArea" label="İnşaat alanı (m²)" error={errors.constructionArea}>
              <Input {...field("constructionArea")} inputMode="decimal" />
            </FormField>
            <FormField id="block-elevatorCount" label="Asansör sayısı" error={errors.elevatorCount}>
              <Input {...field("elevatorCount")} inputMode="numeric" />
            </FormField>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Vazgeç
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <LoaderCircleIcon className="animate-spin" />}
              Kaydet
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DeleteBlockDialog({
  projectId,
  block,
  onClose,
}: {
  projectId: string;
  block: BlockRow;
  onClose: () => void;
}) {
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Bloğu sil</DialogTitle>
          <DialogDescription>“{block.name}” bloğu silinecek. Bu işlem geri alınamaz.</DialogDescription>
        </DialogHeader>
        <FormError message={error} />
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Vazgeç
          </Button>
          <Button
            variant="destructive"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const result = await deleteBlockAction(projectId, block.id);
                if (result.ok) onClose();
                else setError(result.error);
              })
            }
          >
            {pending && <LoaderCircleIcon className="animate-spin" />}
            Sil
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
