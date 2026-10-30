"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { LoaderCircleIcon, SaveIcon } from "lucide-react";
import { FormError, FormField } from "@/components/form-field";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import type { ProjectStatus, Role } from "@/generated/prisma/enums";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth/password-rules";
import { PROJECT_ROLES, ROLE_DESCRIPTIONS, ROLE_LABELS, ROLES } from "@/lib/auth/roles";
import { createUserAction, updateUserAction } from "../actions";

export type UserFormValues = {
  name: string;
  email: string;
  phone: string;
  role: Role;
  active: boolean;
  /** projectId → projedeki rol */
  permissions: Record<string, Role>;
};

export function UserForm({
  userId,
  initial,
  projects,
  isSelf = false,
}: {
  userId?: string;
  initial: UserFormValues;
  projects: { id: string; name: string; status: ProjectStatus }[];
  isSelf?: boolean;
}) {
  const [values, setValues] = useState(initial);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string>();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();
  const editing = Boolean(userId);
  const defaultProjectRole: Role = PROJECT_ROLES.includes(values.role) ? values.role : "teknik_ofis";

  function setRole(role: Role) {
    // Henüz farklı rol seçilmemiş proje yetkileri yeni ana rolü izler.
    const permissions = Object.fromEntries(
      Object.entries(values.permissions).map(([id, current]) => [
        id,
        current === defaultProjectRole && PROJECT_ROLES.includes(role) ? role : current,
      ]),
    );
    setValues({ ...values, role, permissions });
  }

  function toggleProject(projectId: string, checked: boolean) {
    const permissions = { ...values.permissions };
    if (checked) permissions[projectId] = defaultProjectRole;
    else delete permissions[projectId];
    setValues({ ...values, permissions });
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(undefined);
    const input = {
      name: values.name,
      email: values.email,
      phone: values.phone,
      role: values.role,
      permissions: Object.entries(values.permissions).map(([projectId, role]) => ({ projectId, role })),
    };
    startTransition(async () => {
      const result = userId
        ? await updateUserAction(userId, { ...input, active: values.active, password })
        : await createUserAction({ ...input, password });
      // Başarılıysa sunucu listeye yönlendirir.
      if (result && !result.ok) {
        setError(result.error);
        setErrors(result.fieldErrors ?? {});
      }
    });
  }

  return (
    <form onSubmit={submit} className="grid max-w-3xl gap-5">
      <FormError message={error} />
      <Card>
        <CardHeader>
          <CardTitle>Kullanıcı bilgileri</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <FormField id="name" label="Ad soyad" required error={errors.name}>
            <Input id="name" value={values.name} onChange={(e) => setValues({ ...values, name: e.target.value })} />
          </FormField>
          <FormField id="email" label="E-posta" required error={errors.email} hint="Giriş için kullanılır.">
            <Input
              id="email"
              type="email"
              inputMode="email"
              value={values.email}
              onChange={(e) => setValues({ ...values, email: e.target.value })}
            />
          </FormField>
          <FormField id="phone" label="Telefon" error={errors.phone}>
            <Input
              id="phone"
              type="tel"
              value={values.phone}
              onChange={(e) => setValues({ ...values, phone: e.target.value })}
            />
          </FormField>
          <FormField
            id="password"
            label={editing ? "Yeni şifre" : "Şifre"}
            required={!editing}
            error={errors.password}
            hint={
              editing
                ? "Boş bırakılırsa değişmez. Değiştirilirse kullanıcının açık oturumları kapanır."
                : `En az ${MIN_PASSWORD_LENGTH} karakter. Kullanıcıya iletin; ilk girişte değiştirmesini isteyin.`
            }
          >
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </FormField>
          <FormField
            id="role"
            label="Rol"
            required
            error={errors.role}
            hint={ROLE_DESCRIPTIONS[values.role]}
            className="sm:col-span-2"
          >
            <NativeSelect
              id="role"
              value={values.role}
              onChange={(e) => setRole(e.target.value as Role)}
              disabled={isSelf}
            >
              {ROLES.map((role) => (
                <option key={role} value={role}>
                  {ROLE_LABELS[role]}
                </option>
              ))}
            </NativeSelect>
          </FormField>
          {editing && (
            <Label className="font-normal sm:col-span-2">
              <Checkbox
                checked={values.active}
                onCheckedChange={(checked) => setValues({ ...values, active: checked === true })}
                disabled={isSelf}
              />
              Aktif (pasif kullanıcı giriş yapamaz; kayıtları silinmez)
            </Label>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Proje yetkileri</CardTitle>
          <CardDescription>
            {values.role === "yonetici"
              ? "Yönetici tüm projeleri görür; ayrıca proje seçmeye gerek yok."
              : "Kullanıcı yalnızca işaretlenen projeleri görür. Her projede farklı rol verilebilir."}
          </CardDescription>
        </CardHeader>
        {values.role !== "yonetici" && (
          <CardContent>
            {projects.length === 0 ? (
              <p className="text-sm text-muted-foreground">Henüz proje yok.</p>
            ) : (
              <ul className="grid grid-cols-1 gap-2">
                {projects.map((project) => {
                  const role = values.permissions[project.id];
                  return (
                    <li
                      key={project.id}
                      className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center"
                    >
                      <Label className="flex-1 font-normal">
                        <Checkbox
                          checked={Boolean(role)}
                          onCheckedChange={(checked) => toggleProject(project.id, checked === true)}
                          aria-label={`${project.name} projesine yetki`}
                        />
                        <span className="font-medium">{project.name}</span>
                        <StatusBadge status={project.status} />
                      </Label>
                      {role && (
                        <NativeSelect
                          aria-label={`${project.name} projesindeki rol`}
                          value={role}
                          onChange={(e) =>
                            setValues({
                              ...values,
                              permissions: { ...values.permissions, [project.id]: e.target.value as Role },
                            })
                          }
                          className="sm:w-48"
                        >
                          {PROJECT_ROLES.map((r) => (
                            <option key={r} value={r}>
                              {ROLE_LABELS[r]}
                            </option>
                          ))}
                        </NativeSelect>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        )}
      </Card>

      <div className="flex justify-end gap-2">
        <Button asChild variant="outline">
          <Link href="/settings/users">Vazgeç</Link>
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? <LoaderCircleIcon className="animate-spin" /> : <SaveIcon />}
          Kaydet
        </Button>
      </div>
    </form>
  );
}
