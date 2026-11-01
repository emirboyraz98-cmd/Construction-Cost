"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { ActionFailure } from "@/lib/action-result";

/** Server Action çalıştırır; hata ve alan hatalarını tutar, başarıda sayfayı yeniler. */
export function useAction() {
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();
  function run<T extends { ok: true } | ActionFailure>(action: () => Promise<T>, onDone?: (result: Extract<T, { ok: true }>) => void) {
    startTransition(async () => {
      setError(undefined);
      setFieldErrors({});
      const result = await action();
      if (!result.ok) {
        setError(result.error);
        setFieldErrors(result.fieldErrors ?? {});
        return;
      }
      onDone?.(result as Extract<T, { ok: true }>);
      router.refresh();
    });
  }
  const reset = () => {
    setError(undefined);
    setFieldErrors({});
  };
  return { run, error, fieldErrors, pending, reset };
}
