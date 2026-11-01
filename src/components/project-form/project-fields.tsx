"use client";

import { FormField } from "@/components/form-field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import type { LandModel, ProjectStatus, ProjectType } from "@/generated/prisma/enums";
import {
  LAND_MODEL_DESCRIPTIONS,
  LAND_MODEL_LABELS,
  PROJECT_STATUS_LABELS,
  PROJECT_STATUS_ORDER,
  PROJECT_TYPE_LABELS,
} from "@/lib/labels";
import { cn } from "@/lib/utils";

/** Formdaki ham değerler (sayılar metin olarak tutulur; "1.250,50" yazılabilir). */
export type ProjectFormValues = {
  name: string;
  type: ProjectType | "";
  status: ProjectStatus;
  address: string;
  landBlockNo: string;
  landParcelNo: string;
  landArea: string;
  floorAreaRatio: string;
  groundCoverageRatio: string;
  landModel: LandModel | "";
  startDate: string;
  durationMonths: string;
};

export const EMPTY_PROJECT_VALUES: ProjectFormValues = {
  name: "",
  type: "",
  status: "FEASIBILITY",
  address: "",
  landBlockNo: "",
  landParcelNo: "",
  landArea: "",
  floorAreaRatio: "",
  groundCoverageRatio: "",
  landModel: "",
  startDate: "",
  durationMonths: "",
};

type FieldsProps = {
  values: ProjectFormValues;
  errors: Record<string, string>;
  onChange: (patch: Partial<ProjectFormValues>) => void;
};

function errorProps(errors: Record<string, string>, key: string) {
  return errors[key]
    ? { "aria-invalid": true as const, "aria-describedby": `${key}-error` }
    : {};
}

/** Proje bilgileri: ad, tip, durum, adres, ada/parsel, arsa alanı, emsal, TAKS, tarih, süre. */
export function ProjectInfoFields({ values, errors, onChange }: FieldsProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <FormField id="name" label="Proje adı" required error={errors.name} className="sm:col-span-2">
        <Input
          id="name"
          value={values.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder="ör. Kadıköy Konutları"
          maxLength={120}
          {...errorProps(errors, "name")}
        />
      </FormField>
      <FormField id="type" label="Proje tipi" required error={errors.type}>
        <NativeSelect
          id="type"
          value={values.type}
          onChange={(e) => onChange({ type: e.target.value as ProjectType })}
          {...errorProps(errors, "type")}
        >
          <option value="" disabled>
            Seçin…
          </option>
          {Object.entries(PROJECT_TYPE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </NativeSelect>
      </FormField>
      <FormField id="status" label="Durum" error={errors.status}>
        <NativeSelect
          id="status"
          value={values.status}
          onChange={(e) => onChange({ status: e.target.value as ProjectStatus })}
        >
          {PROJECT_STATUS_ORDER.map((status) => (
            <option key={status} value={status}>
              {PROJECT_STATUS_LABELS[status]}
            </option>
          ))}
        </NativeSelect>
      </FormField>
      <FormField id="address" label="Adres" error={errors.address} className="sm:col-span-2">
        <Input
          id="address"
          value={values.address}
          onChange={(e) => onChange({ address: e.target.value })}
          placeholder="Mahalle, sokak, ilçe / il"
          {...errorProps(errors, "address")}
        />
      </FormField>
      <div className="grid grid-cols-2 gap-4 sm:col-span-2 sm:grid-cols-4">
        <FormField id="landBlockNo" label="Ada" error={errors.landBlockNo}>
          <Input
            id="landBlockNo"
            value={values.landBlockNo}
            onChange={(e) => onChange({ landBlockNo: e.target.value })}
            inputMode="numeric"
          />
        </FormField>
        <FormField id="landParcelNo" label="Parsel" error={errors.landParcelNo}>
          <Input
            id="landParcelNo"
            value={values.landParcelNo}
            onChange={(e) => onChange({ landParcelNo: e.target.value })}
            inputMode="numeric"
          />
        </FormField>
        <FormField id="startDate" label="Başlangıç" error={errors.startDate}>
          <Input
            id="startDate"
            type="date"
            value={values.startDate}
            onChange={(e) => onChange({ startDate: e.target.value })}
            {...errorProps(errors, "startDate")}
          />
        </FormField>
        <FormField id="durationMonths" label="Süre (ay)" error={errors.durationMonths}>
          <Input
            id="durationMonths"
            value={values.durationMonths}
            onChange={(e) => onChange({ durationMonths: e.target.value })}
            inputMode="numeric"
            placeholder="ör. 24"
            {...errorProps(errors, "durationMonths")}
          />
        </FormField>
      </div>
      <div className="grid grid-cols-2 gap-4 sm:col-span-2 sm:grid-cols-3">
        <FormField id="landArea" label="Arsa alanı (m²)" error={errors.landArea} className="col-span-2 sm:col-span-1">
          <Input
            id="landArea"
            value={values.landArea}
            onChange={(e) => onChange({ landArea: e.target.value })}
            inputMode="decimal"
            placeholder="ör. 1.250,50"
            {...errorProps(errors, "landArea")}
          />
        </FormField>
        <FormField id="floorAreaRatio" label="Emsal (KAKS)" error={errors.floorAreaRatio}>
          <Input
            id="floorAreaRatio"
            value={values.floorAreaRatio}
            onChange={(e) => onChange({ floorAreaRatio: e.target.value })}
            inputMode="decimal"
            placeholder="ör. 2,07"
            {...errorProps(errors, "floorAreaRatio")}
          />
        </FormField>
        <FormField id="groundCoverageRatio" label="TAKS" error={errors.groundCoverageRatio}>
          <Input
            id="groundCoverageRatio"
            value={values.groundCoverageRatio}
            onChange={(e) => onChange({ groundCoverageRatio: e.target.value })}
            inputMode="decimal"
            placeholder="ör. 0,35"
            {...errorProps(errors, "groundCoverageRatio")}
          />
        </FormField>
      </div>
    </div>
  );
}

/** Arsa modeli: kat karşılığı / satın alma / karma (PLAN.md Bölüm 5.3). */
export function LandModelField({ values, errors, onChange }: FieldsProps) {
  return (
    <fieldset className="grid gap-3">
      <legend className="sr-only">Arsa modeli</legend>
      {(Object.keys(LAND_MODEL_LABELS) as LandModel[]).map((model) => {
        const checked = values.landModel === model;
        return (
          <label
            key={model}
            className={cn(
              "flex cursor-pointer gap-3 rounded-lg border p-4 transition-colors",
              checked ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:bg-accent",
            )}
          >
            <input
              type="radio"
              name="landModel"
              value={model}
              checked={checked}
              onChange={() => onChange({ landModel: model })}
              className="mt-1 size-4 accent-(--primary)"
            />
            <span className="grid gap-1">
              <span className="font-medium">{LAND_MODEL_LABELS[model]}</span>
              <span className="text-sm text-muted-foreground">{LAND_MODEL_DESCRIPTIONS[model]}</span>
            </span>
          </label>
        );
      })}
      {errors.landModel && <p className="text-xs text-destructive">{errors.landModel}</p>}
    </fieldset>
  );
}
