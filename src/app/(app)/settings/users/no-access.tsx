import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";

export function NoUserManagement() {
  return (
    <>
      <PageHeader title="Kullanıcılar" />
      <Card className="max-w-xl">
        <CardContent className="text-sm text-muted-foreground">
          Kullanıcıları yalnızca yönetici yönetebilir.
        </CardContent>
      </Card>
    </>
  );
}
