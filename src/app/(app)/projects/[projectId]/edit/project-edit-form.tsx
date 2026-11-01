"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { LoaderCircleIcon, SaveIcon } from "lucide-react";
import { FormError } from "@/components/form-field";
import {
  LandModelField,
  ProjectInfoFields,
  type ProjectFormValues,
} from "@/components/project-form/project-fields";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { LandModel, ProjectType } from "@/generated/prisma/enums";
import { fieldErrors } from "@/lib/validation/fields";
import { projectInfoSchema } from "@/lib/validation/project";
import { updateProjectAction } from "../actions";

export function ProjectEditForm({
  projectId,
  initialValues,
}: {
  projectId: string;
  initialValues: ProjectFormValues;
}) {
  const router = useRouter();
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string>();
  const [pending, startTransition] = useTransition();

  const change = (patch: Partial<ProjectFormValues>) => setValues((current) => ({ ...current, ...patch }));

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setFormError(undefined);
    const input = { ...values, type: values.type as ProjectType, landModel: values.landModel as LandModel };
    const parsed = projectInfoSchema.safeParse(input);
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    setErrors({});
    startTransition(async () => {
      const result = await updateProjectAction(projectId, input);
      if (!result.ok) {
        setFormError(result.error);
        setErrors(result.fieldErrors ?? {});
        return;
      }
      router.push(`/projects/${projectId}`);
    });
  }

  return (
    <form onSubmit={submit} className="grid max-w-3xl gap-5">
      <FormError message={formError} />
      <Card>
        <CardHeader>
          <CardTitle>Proje bilgileri</CardTitle>
        </CardHeader>
        <CardContent>
          <ProjectInfoFields values={values} errors={errors} onChange={change} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Arsa modeli</CardTitle>
        </CardHeader>
        <CardContent>
          <LandModelField values={values} errors={errors} onChange={change} />
        </CardContent>
      </Card>
      <div className="flex justify-end gap-2">
        <Button asChild variant="outline">
          <Link href={`/projects/${projectId}`}>Vazgeç</Link>
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? <LoaderCircleIcon className="animate-spin" /> : <SaveIcon />}
          Kaydet
        </Button>
      </div>
    </form>
  );
}
