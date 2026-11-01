import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { NoAccess } from "@/components/purchasing/shared";
import { dateToDateInput } from "@/lib/format";
import { drawOptions } from "@/server/connections";
import { getProject } from "@/server/projects";
import { DeliveryForm } from "./delivery-form";

export const metadata: Metadata = { title: "Malzeme geldi" };

export default async function DeliveryPage({ params }: PageProps<"/projects/[projectId]/expenses/delivery">) {
  const { projectId } = await params;
  const { project } = await getProject(projectId);
  if (!project) notFound();
  const data = await drawOptions(projectId);
  if (!data) return <NoAccess text="Bu projede malzeme girişi yetkiniz yok." />;
  return (
    <>
      <PageHeader
        title="Malzeme geldi"
        description="Bağlantıdan gelen malzemeyi girin: hangi bağlantı, kaç birim, irsaliye no. Tutar kendiliğinden hesaplanır."
      />
      {data.options.length === 0 ? (
        <NoAccess text="Bu proje için çekilebilecek aktif bağlantı yok. Satın alma, bağlantıyı projeye tahsis etmeli veya havuzda miktar bırakmalı." />
      ) : (
        <DeliveryForm
          projectId={projectId}
          today={dateToDateInput(new Date())}
          blocks={data.blocks}
          options={data.options.map((o) => ({ ...o, lastDrawDate: o.lastDrawDate?.toISOString() ?? null }))}
        />
      )}
    </>
  );
}
