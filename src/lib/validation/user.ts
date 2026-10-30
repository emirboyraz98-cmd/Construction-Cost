import { z } from "zod";
import { Role } from "@/generated/prisma/enums";
import { MIN_PASSWORD_LENGTH } from "../auth/password-rules";
import { optionalText, requiredText } from "./fields";

const password = z
  .string()
  .min(MIN_PASSWORD_LENGTH, `Şifre en az ${MIN_PASSWORD_LENGTH} karakter olmalı.`)
  .max(200, "Şifre çok uzun.");

const userBase = {
  name: requiredText("Ad soyad", 100),
  email: z.string().trim().toLowerCase().pipe(z.email("Geçerli bir e-posta adresi girin.")),
  phone: optionalText(30),
  role: z.enum(Role, { error: "Rol seçin." }),
  permissions: z
    .array(z.object({ projectId: z.string().min(1), role: z.enum(Role) }))
    .default([]),
};

export const createUserSchema = z.object({ ...userBase, password });

export const updateUserSchema = z.object({
  ...userBase,
  active: z.boolean(),
  /** Boş bırakılırsa şifre değişmez. */
  password: z
    .string()
    .optional()
    .transform((value) => (value ? value : undefined))
    .pipe(password.optional()),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Mevcut şifrenizi girin."),
    newPassword: password,
    confirmPassword: z.string(),
  })
  .refine((value) => value.newPassword === value.confirmPassword, {
    path: ["confirmPassword"],
    message: "Yeni şifreler aynı değil.",
  });

export type CreateUserInput = z.input<typeof createUserSchema>;
export type UpdateUserInput = z.input<typeof updateUserSchema>;
