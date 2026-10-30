import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeftIcon } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { NoAccess } from "@/components/purchasing/shared";
import { Button } from "@/components/ui/button";
import { hasCapability } from "@/lib/auth/roles";
import { formatNumber } from "@/lib/format";
import { getAccess } from "@/server/access";
import { getRecipe, listResources } from "@/server/library";
import { RecipeForm } from "../recipe-form";

export const metadata: Metadata = { title: "Reçete" };

export default async function RecipePage({ params }: PageProps<"/company/library/recipes/[recipeId]">) {
  const { recipeId } = await params;
  const { user } = await getAccess();
  if (!hasCapability(user.role, "library.view")) return <NoAccess text="Kütüphaneyi görme yetkiniz yok." />;
  const isNew = recipeId === "new";
  const [data, resources] = await Promise.all([isNew ? null : getRecipe(recipeId), listResources()]);
  if (!isNew && !data) notFound();
  const canManage = hasCapability(user.role, "library.manage");
  const r = data?.recipe;
  return (
    <>
      <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2">
        <Link href="/company/library/recipes">
          <ArrowLeftIcon />
          Reçeteler
        </Link>
      </Button>
      <PageHeader title={r ? `${r.code} · ${r.name}` : "Yeni reçete"} description="Örn. 1 m² zemin seramiği = 1 m² seramik (%8 fire) + 5 kg yapıştırıcı + 0,4 kg derz + 1 m² ustalık." />
      <RecipeForm
        recipeId={r?.id ?? null}
        canManage={canManage}
        resources={resources.rows.map((res) => ({
          id: res.id,
          code: res.code,
          name: res.name,
          unit: res.unit,
          wastePercent: res.wastePercent.toString(),
          priceTry: res.price.priceTry?.toString() ?? null,
        }))}
        initial={
          r
            ? {
                code: r.code,
                name: r.name,
                unit: r.unit,
                description: r.description ?? "",
                active: r.active,
                lines: r.lines.map((l) => ({ key: l.id, resourceId: l.resourceId, quantity: formatNumber(l.quantity, 6) })),
              }
            : { code: "", name: "", unit: "", description: "", active: true, lines: [{ key: "first", resourceId: null, quantity: "" }] }
        }
      />
    </>
  );
}
