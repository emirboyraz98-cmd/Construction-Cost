import { LoaderCircleIcon } from "lucide-react";

export function PageLoading() {
  return (
    <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground" role="status">
      <LoaderCircleIcon className="size-4 animate-spin" />
      Yükleniyor…
    </div>
  );
}
