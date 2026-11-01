// Proje sekmelerinin sıralama mantığı (saf fonksiyonlar). Veritabanındaki UserTab
// kayıtlarının `position` alanı bu fonksiyonların ürettiği sırayla yazılır.

export type Tab = { projectId: string; position: number };

/** Sekmeleri konuma göre sıralar ve konumları 0, 1, 2 … olarak yeniden numaralar. */
export function normalizeTabs(tabs: readonly Tab[]): Tab[] {
  return [...tabs]
    .sort((a, b) => a.position - b.position)
    .map((tab, index) => ({ projectId: tab.projectId, position: index }));
}

/** Proje zaten açıksa sekmeler değişmez; değilse en sona eklenir. */
export function openTab(tabs: readonly Tab[], projectId: string): Tab[] {
  const normalized = normalizeTabs(tabs);
  if (normalized.some((tab) => tab.projectId === projectId)) return normalized;
  return [...normalized, { projectId, position: normalized.length }];
}

/** Sekmeyi kapatır (proje silinmez); kalanların sırası korunur. */
export function closeTab(tabs: readonly Tab[], projectId: string): Tab[] {
  return normalizeTabs(tabs.filter((tab) => tab.projectId !== projectId));
}

/** Sekmeyi yeni konuma taşır (sürükle-bırak). */
export function moveTab(tabs: readonly Tab[], projectId: string, toIndex: number): Tab[] {
  const ordered = normalizeTabs(tabs);
  const from = ordered.findIndex((tab) => tab.projectId === projectId);
  if (from === -1) return ordered;
  const target = Math.max(0, Math.min(toIndex, ordered.length - 1));
  const [moved] = ordered.splice(from, 1);
  ordered.splice(target, 0, moved);
  return ordered.map((tab, index) => ({ projectId: tab.projectId, position: index }));
}

/**
 * Açık sekme kapatılınca geçilecek proje: sağdaki sekme, yoksa soldaki;
 * hiç sekme kalmıyorsa null (portföye dönülür).
 */
export function tabAfterClose(tabs: readonly Tab[], closingProjectId: string): string | null {
  const ordered = normalizeTabs(tabs);
  const index = ordered.findIndex((tab) => tab.projectId === closingProjectId);
  if (index === -1) return null;
  return ordered[index + 1]?.projectId ?? ordered[index - 1]?.projectId ?? null;
}
