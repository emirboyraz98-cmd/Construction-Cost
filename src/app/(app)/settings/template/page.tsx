import type { Metadata } from "next";
import { CostTree, CostTreeActionsProvider } from "@/app/(app)/projects/[projectId]/cost-tree/cost-tree";
import { PageHeader } from "@/components/page-header";
import { NoAccess } from "@/components/purchasing/shared";
import { hasCapability } from "@/lib/auth/roles";
import { getAccess } from "@/server/access";
import { listTemplateItems } from "@/server/templates";
import { addTemplateItemAction, setTemplateItemActiveAction } from "./actions";

export const metadata: Metadata = { title: "Maliyet ağacı şablonu" };

export default async function TemplatePage() {
  const { user } = await getAccess();
  if (!hasCapability(user.role, "costTree.edit")) return <NoAccess text="Şablonu yönetici ve teknik ofis düzenler." />;
  const items = await listTemplateItems();
  return (
    <>
      <PageHeader
        title="Maliyet ağacı şablonu"
        description="Yeni projeler bu İKY ağacıyla açılır. Buradaki değişiklik mevcut projeleri etkilemez (projedeki ağaç, proje → Maliyet ağacı ekranından düzenlenir). Kullanılmayan kalemleri pasifleştirin; şirkete özel kalemleri ekleyin."
      />
      <CostTreeActionsProvider add={addTemplateItemAction} setActive={setTemplateItemActiveAction}>
        <CostTree projectId="sablon" items={items} canEdit />
      </CostTreeActionsProvider>
    </>
  );
}
