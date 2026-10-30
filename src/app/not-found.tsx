import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-lg px-4 py-16 text-center">
      <h1 className="text-lg font-semibold">Sayfa bulunamadı</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Aradığınız sayfa yok ya da bu sayfayı görme yetkiniz bulunmuyor.
      </p>
      <Button asChild className="mt-4">
        <Link href="/portfolio">Portföye dön</Link>
      </Button>
    </div>
  );
}
