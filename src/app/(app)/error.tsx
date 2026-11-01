"use client";

import { Button } from "@/components/ui/button";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto max-w-lg py-10 text-center">
      <h1 className="text-lg font-semibold">Bir hata oluştu</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Sayfa yüklenirken beklenmeyen bir sorun çıktı. Tekrar deneyin; sorun sürerse yöneticinize
        bildirin.
      </p>
      {error.digest && <p className="mt-1 text-xs text-muted-foreground">Hata kodu: {error.digest}</p>}
      <Button className="mt-4" onClick={reset}>
        Tekrar dene
      </Button>
    </div>
  );
}
