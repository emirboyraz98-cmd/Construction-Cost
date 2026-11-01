"use client";

import { useState } from "react";
import { DatabaseBackupIcon, LoaderCircleIcon } from "lucide-react";
import { FormError } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { useAction } from "@/components/use-action";
import { backupNowAction } from "./actions";

export function BackupButton() {
  const { run, error, pending } = useAction();
  const [message, setMessage] = useState<string | null>(null);
  return (
    <div className="grid gap-2">
      <div>
        <Button disabled={pending} onClick={() => run(() => backupNowAction(), (r) => setMessage(r.message))}>
          {pending ? <LoaderCircleIcon className="animate-spin" /> : <DatabaseBackupIcon />}
          Şimdi yedek al
        </Button>
      </div>
      <FormError message={error} />
      {message && <p className="text-sm text-emerald-700">{message}</p>}
    </div>
  );
}
