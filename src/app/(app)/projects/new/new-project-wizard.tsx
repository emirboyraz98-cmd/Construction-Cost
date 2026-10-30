"use client";

import { useState, useTransition } from "react";
import { ArrowLeftIcon, ArrowRightIcon, CheckIcon, CopyIcon, LoaderCircleIcon } from "lucide-react";
import { FormError, FormField } from "@/components/form-field";
import { BlockRows, newBlockRow, suggestBlockName, type BlockRowValues } from "@/components/project-form/block-rows";
import {
  EMPTY_PROJECT_VALUES,
  LandModelField,
  ProjectInfoFields,
  type ProjectFormValues,
} from "@/components/project-form/project-fields";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { NativeSelect } from "@/components/ui/native-select";
import type { LandModel, ProjectType } from "@/generated/prisma/enums";
import { totalConstructionArea } from "@/lib/calc/zoning";
import { formatNumber, parseDecimalInput } from "@/lib/format";
import { LAND_MODEL_LABELS, PROJECT_TYPE_LABELS } from "@/lib/labels";
import { fieldErrors } from "@/lib/validation/fields";
import { createProjectSchema, projectInfoSchema, type CreateProjectInput } from "@/lib/validation/project";
import { cn } from "@/lib/utils";
import { createProjectAction } from "./actions";

export type CopySourceProject = {
  id: string;
  name: string;
  type: ProjectType;
  landModel: LandModel;
  costItemCount: number;
  blocks: { name: string; floorCount: number | null; basementCount: number | null; constructionArea: string | null }[];
};

const STEPS = ["Proje bilgileri", "Arsa modeli", "Bloklar"] as const;

function toInput(values: ProjectFormValues, blocks: BlockRowValues[], copyFrom: string): CreateProjectInput {
  return {
    ...values,
    type: values.type as ProjectType,
    landModel: values.landModel as LandModel,
    blocks: blocks.map((block) => ({
      name: block.name,
      floorCount: block.floorCount,
      basementCount: block.basementCount,
      constructionArea: block.constructionArea,
    })),
    copyFromProjectId: copyFrom || null,
  };
}

/** Yeni proje sihirbazı (Faz 0): proje bilgileri → arsa modeli → bloklar. */
export function NewProjectWizard({
  sources,
  templateItemCount,
}: {
  sources: CopySourceProject[];
  templateItemCount: number;
}) {
  const [step, setStep] = useState(0);
  const [values, setValues] = useState<ProjectFormValues>(EMPTY_PROJECT_VALUES);
  const [blocks, setBlocks] = useState<BlockRowValues[]>(() => [newBlockRow("A Blok", { key: "blok-ilk" })]);
  const [copyFrom, setCopyFrom] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string>();
  const [pending, startTransition] = useTransition();

  const source = sources.find((s) => s.id === copyFrom);

  function change(patch: Partial<ProjectFormValues>) {
    setValues((current) => ({ ...current, ...patch }));
    // Tip villa yapılınca henüz düzenlenmemiş ilk blok adı da uyarlanır.
    if (patch.type && blocks.length === 1 && ["A Blok", "Villa 1"].includes(blocks[0].name)) {
      setBlocks([{ ...blocks[0], name: suggestBlockName([], patch.type) }]);
    }
  }

  function chooseSource(id: string) {
    setCopyFrom(id);
    const chosen = sources.find((s) => s.id === id);
    if (!chosen) return;
    setValues((current) => ({ ...current, type: chosen.type, landModel: chosen.landModel }));
    if (chosen.blocks.length > 0) {
      setBlocks(
        chosen.blocks.map((block) =>
          newBlockRow(block.name, {
            floorCount: block.floorCount?.toString() ?? "",
            basementCount: block.basementCount?.toString() ?? "",
            constructionArea: block.constructionArea?.replace(".", ",") ?? "",
          }),
        ),
      );
    }
  }

  function validateStep(target: number): boolean {
    let result: { success: boolean; error?: Parameters<typeof fieldErrors>[0] };
    if (target === 0) {
      result = projectInfoSchema.omit({ landModel: true }).safeParse(values);
    } else if (target === 1) {
      result = projectInfoSchema.pick({ landModel: true }).safeParse(values);
    } else {
      result = createProjectSchema.safeParse(toInput(values, blocks, copyFrom));
    }
    setErrors(result.success || !result.error ? {} : fieldErrors(result.error));
    return result.success;
  }

  function next() {
    if (validateStep(step)) setStep(step + 1);
  }

  function submit() {
    setFormError(undefined);
    if (!validateStep(2)) return;
    startTransition(async () => {
      const result = await createProjectAction(toInput(values, blocks, copyFrom));
      // Başarılıysa sunucu yeni projeye yönlendirir; buraya yalnızca hata dönerse gelinir.
      if (result && !result.ok) {
        setFormError(result.error);
        setErrors(result.fieldErrors ?? {});
        const fields = Object.keys(result.fieldErrors ?? {});
        if (fields.some((f) => !f.startsWith("blocks") && f !== "landModel")) setStep(0);
        else if (fields.includes("landModel")) setStep(1);
      }
    });
  }

  const totalArea = totalConstructionArea(
    blocks.map((block) => {
      const parsed = parseDecimalInput(block.constructionArea);
      return { constructionArea: parsed.ok ? parsed.value : null };
    }),
  );

  return (
    <div className="grid max-w-3xl gap-5">
      <ol className="flex gap-2 sm:grid sm:grid-cols-3" aria-label="Adımlar">
        {STEPS.map((label, index) => (
          <li
            key={label}
            aria-current={index === step ? "step" : undefined}
            className={cn(
              "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm",
              index === step ? "flex-1 border-primary bg-primary/5 font-medium text-primary" : "shrink-0",
              index < step && "text-muted-foreground",
            )}
          >
            <span
              className={cn(
                "flex size-5 shrink-0 items-center justify-center rounded-full border text-[11px]",
                index < step && "border-primary bg-primary text-primary-foreground",
                index === step && "border-primary",
              )}
            >
              {index < step ? <CheckIcon className="size-3" /> : index + 1}
            </span>
            <span className={cn("truncate", index !== step && "hidden sm:inline")}>{label}</span>
          </li>
        ))}
      </ol>

      <FormError message={formError} />

      {step === 0 && (
        <>
          {sources.length > 0 && (
            <Card className="gap-3 py-4">
              <CardContent className="grid gap-2">
                <FormField
                  id="copyFrom"
                  label={
                    <span className="flex items-center gap-2">
                      <CopyIcon className="size-4" /> Başlangıç
                    </span>
                  }
                  hint={
                    source
                      ? `“${source.name}” projesinin maliyet ağacı (${source.costItemCount} kalem, eklenen ve pasif kalemler dahil), tipi, arsa modeli ve blokları kopyalanır. Değerleri değiştirebilirsiniz.`
                      : `Varsayılan maliyet ağacı şablonu (${templateItemCount} kalem) kullanılır.`
                  }
                >
                  <NativeSelect id="copyFrom" value={copyFrom} onChange={(e) => chooseSource(e.target.value)}>
                    <option value="">Boş proje — varsayılan şablondan</option>
                    {sources.map((s) => (
                      <option key={s.id} value={s.id}>
                        Mevcut projeden kopyala: {s.name}
                      </option>
                    ))}
                  </NativeSelect>
                </FormField>
              </CardContent>
            </Card>
          )}
          <Card>
            <CardHeader>
              <CardTitle>Proje bilgileri</CardTitle>
              <CardDescription>Yıldızlı alanlar zorunlu; diğerlerini sonra da doldurabilirsiniz.</CardDescription>
            </CardHeader>
            <CardContent>
              <ProjectInfoFields values={values} errors={errors} onChange={change} />
            </CardContent>
          </Card>
        </>
      )}

      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Arsa modeli</CardTitle>
            <CardDescription>
              Arsa sahipleri, paylar ve ödeme planı ayrıntıları Faz 3&apos;teki “Arsa &amp; sözleşme” ekranında girilecek.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <LandModelField values={values} errors={errors} onChange={change} />
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Bloklar</CardTitle>
              <CardDescription>
                Her bina bir bloktur (villa projelerinde her villa). Bağımsız bölümler Faz 3&apos;te eklenecek.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <BlockRows rows={blocks} errors={errors} projectType={values.type} onChange={setBlocks} />
              {errors.blocks && <p className="mt-2 text-xs text-destructive">{errors.blocks}</p>}
            </CardContent>
          </Card>
          <Card className="gap-2 bg-muted/40 py-4">
            <CardContent className="grid gap-1 text-sm">
              <p className="font-medium">{values.name}</p>
              <p className="text-muted-foreground">
                {values.type && PROJECT_TYPE_LABELS[values.type]} ·{" "}
                {values.landModel && LAND_MODEL_LABELS[values.landModel]} · {blocks.length} blok
                {totalArea.gt(0) && ` · ${formatNumber(totalArea, 2)} m² inşaat alanı`}
              </p>
              <p className="text-muted-foreground">
                Kaydedince maliyet ağacı ({source ? `“${source.name}” projesinden` : "varsayılan şablondan"})
                kopyalanır ve proje yeni sekmede açılır.
              </p>
            </CardContent>
          </Card>
        </>
      )}

      <div className="flex items-center justify-between gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setErrors({});
            setStep(step - 1);
          }}
          disabled={step === 0 || pending}
        >
          <ArrowLeftIcon />
          Geri
        </Button>
        {step < STEPS.length - 1 ? (
          <Button type="button" onClick={next}>
            İleri
            <ArrowRightIcon />
          </Button>
        ) : (
          <Button type="button" onClick={submit} disabled={pending}>
            {pending ? <LoaderCircleIcon className="animate-spin" /> : <CheckIcon />}
            Projeyi oluştur
          </Button>
        )}
      </div>
    </div>
  );
}
