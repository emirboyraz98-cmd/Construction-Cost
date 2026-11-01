// İKY ağacı yardımcıları (saf fonksiyonlar, veritabanından bağımsız).
// Kodlar iki haneli parçalardan oluşur: "05", "05.04", "05.04.01".

const SEGMENT = /^\d{2,3}$/;

export function codeSegments(code: string): string[] {
  return code.split(".");
}

export function isValidCode(code: string): boolean {
  return code.length > 0 && codeSegments(code).every((segment) => SEGMENT.test(segment));
}

/** "05.04.01" → "05.04", "05" → null */
export function parentCodeOf(code: string): string | null {
  const segments = codeSegments(code);
  return segments.length > 1 ? segments.slice(0, -1).join(".") : null;
}

export function codeDepth(code: string): number {
  return codeSegments(code).length - 1;
}

/** Kodları parça parça sayısal karşılaştırır: "05.04.10" > "05.04.09", "05.04" < "05.04.01". */
export function compareCodes(a: string, b: string): number {
  const left = codeSegments(a);
  const right = codeSegments(b);
  for (let i = 0; i < Math.min(left.length, right.length); i++) {
    const diff = Number(left[i]) - Number(right[i]);
    if (diff !== 0) return diff;
  }
  return left.length - right.length;
}

/** Kodun verilen üst kalemin doğrudan alt kodu olup olmadığı. */
export function isDirectChildCode(code: string, parentCode: string | null): boolean {
  return isValidCode(code) && parentCodeOf(code) === parentCode;
}

/** Üst kalem altında sıradaki boş kod: kardeşlerin en büyüğü + 1 (iki haneli). */
export function nextChildCode(parentCode: string | null, siblingCodes: readonly string[]): string {
  const last = siblingCodes
    .filter((code) => parentCodeOf(code) === parentCode)
    .map((code) => Number(codeSegments(code).at(-1)))
    .reduce((max, value) => Math.max(max, value), 0);
  const segment = String(last + 1).padStart(2, "0");
  return parentCode ? `${parentCode}.${segment}` : segment;
}

export type TreeRow = { id: string; parentId: string | null; code: string };

export type TreeNode<T extends TreeRow> = T & { children: TreeNode<T>[] };

/** Düz listeden kod sırasına göre dizilmiş ağaç kurar. */
export function buildTree<T extends TreeRow>(rows: readonly T[]): TreeNode<T>[] {
  const nodes = new Map<string, TreeNode<T>>();
  for (const row of rows) nodes.set(row.id, { ...row, children: [] });
  const roots: TreeNode<T>[] = [];
  for (const node of nodes.values()) {
    const parent = node.parentId ? nodes.get(node.parentId) : undefined;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }
  const sort = (list: TreeNode<T>[]) => {
    list.sort((a, b) => compareCodes(a.code, b.code));
    list.forEach((node) => sort(node.children));
  };
  sort(roots);
  return roots;
}

/** Bir kalemin tüm alt kalemleri (torunlar dahil). */
export function descendantIds(rows: readonly TreeRow[], id: string): string[] {
  const childrenOf = new Map<string, string[]>();
  for (const row of rows) {
    if (!row.parentId) continue;
    const list = childrenOf.get(row.parentId) ?? [];
    list.push(row.id);
    childrenOf.set(row.parentId, list);
  }
  const result: string[] = [];
  const stack = [...(childrenOf.get(id) ?? [])];
  while (stack.length > 0) {
    const current = stack.pop()!;
    result.push(current);
    stack.push(...(childrenOf.get(current) ?? []));
  }
  return result;
}

/** Bir kalemin üst kalemleri (yakından uzağa). */
export function ancestorIds(rows: readonly TreeRow[], id: string): string[] {
  const byId = new Map(rows.map((row) => [row.id, row]));
  const result: string[] = [];
  let current = byId.get(id)?.parentId ?? null;
  while (current && !result.includes(current)) {
    result.push(current);
    current = byId.get(current)?.parentId ?? null;
  }
  return result;
}

/** Kopyalanacak kaynak kalem (şablon veya başka projenin kalemi). */
export type CopySource = {
  id: string;
  parentId: string | null;
  code: string;
  name: string;
  unit: string | null;
  description: string | null;
  active: boolean;
  /** Kaynak bir proje kalemiyse onun şablon bağlantısı; şablonun kendisiyse undefined. */
  templateId?: string | null;
};

export type CostItemDraft = {
  id: string;
  projectId: string;
  parentId: string | null;
  templateId: string | null;
  code: string;
  name: string;
  unit: string | null;
  description: string | null;
  sortOrder: number;
  active: boolean;
};

/**
 * Şablonu (veya başka bir projenin ağacını) yeni projeye kopyalamak için satırları hazırlar:
 * her kaleme yeni kimlik verir, üst kalem bağlantılarını yeni kimliklere çevirir ve
 * üst kalemler alt kalemlerinden önce gelecek şekilde sıralar.
 */
export function planCostTreeCopy(
  sources: readonly CopySource[],
  projectId: string,
  newId: () => string,
  fromTemplate: boolean,
): CostItemDraft[] {
  const displayOrder = new Map(
    [...sources].sort((a, b) => compareCodes(a.code, b.code)).map((source, i) => [source.id, i]),
  );
  const sorted = [...sources].sort(
    (a, b) => codeDepth(a.code) - codeDepth(b.code) || compareCodes(a.code, b.code),
  );
  const idMap = new Map<string, string>();
  for (const source of sorted) idMap.set(source.id, newId());

  return sorted.map((source) => {
    const parentId = source.parentId ? idMap.get(source.parentId) : null;
    if (parentId === undefined) {
      throw new Error(`Kopyalama hatası: "${source.code}" kaleminin üst kalemi listede yok.`);
    }
    return {
      id: idMap.get(source.id)!,
      projectId,
      parentId,
      templateId: fromTemplate ? source.id : (source.templateId ?? null),
      code: source.code,
      name: source.name,
      unit: source.unit,
      description: source.description,
      sortOrder: displayOrder.get(source.id)!,
      active: source.active,
    };
  });
}
