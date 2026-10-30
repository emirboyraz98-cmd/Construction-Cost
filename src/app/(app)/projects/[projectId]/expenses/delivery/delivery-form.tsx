"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { LoaderCircleIcon, PackageCheckIcon } from "lucide-react";
import { createDrawAction } from "@/app/(app)/company/connections/actions";
import { FilePicker } from "@/components/expenses/file-picker";
import { FormError, FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { toFormData } from "@/lib/form-data";
import { Decimal, formatDateOnly, formatNumber, parseDecimalInput } from "@/lib/format";
import { cn } from "@/lib/utils";

export type DrawOption = {
  itemId: string;
  connectionNo: string;
  supplierName: string;
  description: string;
  unit: string;
  projectRemaining: string;
  pool: string;
  available: string;
  lastDrawDate: string | null;
};

/** Şantiyeden "malzeme geldi": bağlantı kalemi, miktar, irsaliye, fotoğraf. Fiyat gösterilmez. */
export function DeliveryForm({
  projectId,
  options,
  blocks,
  today,
}: {
  projectId: string;
  options: DrawOption[];
  blocks: { id: string; name: string }[];
  today: string;
}) {
  const router = useRouter();
  const [itemId, setItemId] = useState<string | null>(options.length === 1 ? options[0].itemId : null);
  const [quantity, setQuantity] = useState("");
  const [date, setDate] = useState(today);
  const [documentNo, setDocumentNo] = useState("");
  const [blockId, setBlockId] = useState(blocks.length === 1 ? blocks[0].id : "");
  const [description, setDescription] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const selected = options.find((o) => o.itemId === itemId);
  const parsed = parseDecimalInput(quantity);
  const qty = parsed.ok && parsed.value ? parsed.value : null;
  const fromPool = selected && qty ? Decimal.max(qty.minus(selected.projectRemaining), 0) : new Decimal(0);

  return (
    <form
      className="grid max-w-2xl gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        startTransition(async () => {
          setError(undefined);
          const result = await createDrawAction(
            projectId,
            toFormData({ itemId, date, quantity, documentNo, blockId: blockId || null, description }, files),
          );
          if (!result.ok) {
            setError(result.error);
            setErrors(result.fieldErrors ?? {});
            return;
          }
          router.push(`/projects/${projectId}/expenses/${result.id}`);
          router.refresh();
        });
      }}
    >
      <FormError message={error} />
      <Card>
        <CardContent className="grid gap-4">
          <fieldset className="grid gap-2">
            <legend className="mb-1 text-sm font-medium">Hangi bağlantıdan geldi?</legend>
            {errors.itemId && <p className="text-xs text-destructive">{errors.itemId}</p>}
            {options.map((o) => (
              <label
                key={o.itemId}
                className={cn(
                  "flex cursor-pointer flex-wrap items-start justify-between gap-2 rounded-lg border p-3 text-sm",
                  itemId === o.itemId && "border-primary bg-primary/5 ring-1 ring-primary",
                )}
              >
                <span className="flex min-w-0 items-start gap-2">
                  <input type="radio" name="item" className="mt-1 size-4" checked={itemId === o.itemId} onChange={() => setItemId(o.itemId)} />
                  <span className="min-w-0">
                    <span className="block font-medium">{o.description}</span>
                    <span className="block text-xs text-muted-foreground">
                      {o.supplierName} · {o.connectionNo}
                      {o.lastDrawDate && ` · son çekiş ${formatDateOnly(o.lastDrawDate)}`}
                    </span>
                  </span>
                </span>
                <span className="text-right text-xs tabular-nums">
                  Çekilebilir <strong className="text-sm">{formatNumber(o.available, 4)}</strong> {o.unit}
                  <span className="block text-muted-foreground">
                    projeye ayrılan {formatNumber(o.projectRemaining, 4)} · havuz {formatNumber(o.pool, 4)}
                  </span>
                </span>
              </label>
            ))}
          </fieldset>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField id="quantity" label={`Gelen miktar${selected ? ` (${selected.unit})` : ""}`} required error={errors.quantity}>
              <Input id="quantity" inputMode="decimal" className="text-lg font-semibold" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
            </FormField>
            <FormField id="date" label="Tarih" required error={errors.date}>
              <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </FormField>
            <FormField id="documentNo" label="İrsaliye no" error={errors.documentNo}>
              <Input id="documentNo" value={documentNo} onChange={(e) => setDocumentNo(e.target.value)} />
            </FormField>
            {blocks.length > 0 && (
              <FormField id="blockId" label="Blok">
                <NativeSelect id="blockId" value={blockId} onChange={(e) => setBlockId(e.target.value)}>
                  <option value="">Ortak / belirtilmemiş</option>
                  {blocks.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </NativeSelect>
              </FormField>
            )}
          </div>
          {fromPool.gt(0) && selected && (
            <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
              Projeye ayrılan miktar yetmiyor; {formatNumber(fromPool, 4)} {selected.unit} şirket geneli havuzdan bu projeye otomatik tahsis edilecek.
            </p>
          )}
          <FormField id="description" label="Not">
            <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="ör. 2 mikser, C30" />
          </FormField>
          <div className="grid gap-1.5">
            <span className="text-sm font-medium">İrsaliye fotoğrafı</span>
            <FilePicker files={files} onChange={setFiles} />
          </div>
        </CardContent>
      </Card>
      <div className="flex flex-wrap justify-between gap-2">
        <Button asChild variant="ghost">
          <Link href={`/projects/${projectId}/expenses`}>Vazgeç</Link>
        </Button>
        <Button type="submit" size="lg" disabled={pending || !itemId}>
          {pending ? <LoaderCircleIcon className="animate-spin" /> : <PackageCheckIcon />}
          Kaydet
        </Button>
      </div>
    </form>
  );
}
