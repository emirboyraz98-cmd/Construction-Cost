import { HourglassIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "./page-header";

/** Henüz yapılmamış ekranlar için yer tutucu. */
export function ComingSoon({
  title,
  description,
  phase,
}: {
  title: string;
  description: string;
  phase: number;
}) {
  return (
    <>
      <PageHeader title={title} />
      <Card className="max-w-2xl">
        <CardContent className="flex gap-4">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-amber-50 text-amber-700">
            <HourglassIcon className="size-5" />
          </div>
          <div className="grid gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">Bu ekran yakında eklenecek</span>
              <Badge variant="soon">Faz {phase}</Badge>
            </div>
            <p className="text-sm text-muted-foreground">{description}</p>
            <p className="text-xs text-muted-foreground">
              Yol haritası için PLAN.md Bölüm 14&apos;e bakın.
            </p>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
