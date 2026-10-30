"use client";

import { useActionState } from "react";
import { LoaderCircleIcon } from "lucide-react";
import { FormError, FormField } from "@/components/form-field";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth/password-rules";
import { changePasswordAction, type PasswordState } from "../actions";

export function PasswordForm() {
  const [state, action, pending] = useActionState<PasswordState, FormData>(changePasswordAction, {});
  const errors = state.fieldErrors ?? {};

  return (
    <form action={action} className="grid gap-4">
      {state.ok && (
        <Alert variant="info">
          <AlertDescription>Şifreniz değiştirildi.</AlertDescription>
        </Alert>
      )}
      <FormError message={state.error} />
      <FormField id="currentPassword" label="Mevcut şifre" required error={errors.currentPassword}>
        <Input id="currentPassword" name="currentPassword" type="password" autoComplete="current-password" required />
      </FormField>
      <FormField
        id="newPassword"
        label="Yeni şifre"
        required
        error={errors.newPassword}
        hint={`En az ${MIN_PASSWORD_LENGTH} karakter.`}
      >
        <Input id="newPassword" name="newPassword" type="password" autoComplete="new-password" required />
      </FormField>
      <FormField id="confirmPassword" label="Yeni şifre (tekrar)" required error={errors.confirmPassword}>
        <Input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" required />
      </FormField>
      <Button type="submit" disabled={pending} className="justify-self-start">
        {pending && <LoaderCircleIcon className="animate-spin" />}
        Şifreyi değiştir
      </Button>
    </form>
  );
}
