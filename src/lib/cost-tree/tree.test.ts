import { describe, expect, it } from "vitest";
import { DEFAULT_COST_TEMPLATE } from "./default-template";
import {
  ancestorIds,
  buildTree,
  compareCodes,
  descendantIds,
  isDirectChildCode,
  isValidCode,
  nextChildCode,
  parentCodeOf,
  planCostTreeCopy,
  type CopySource,
} from "./tree";

/** Şablonu veritabanındaki gibi kimlikli satırlara çevirir (seed ile aynı mantık). */
function templateRows(): CopySource[] {
  const idOf = (code: string) => `tpl-${code}`;
  return DEFAULT_COST_TEMPLATE.map((item) => {
    const parent = parentCodeOf(item.code);
    return {
      id: idOf(item.code),
      parentId: parent ? idOf(parent) : null,
      code: item.code,
      name: item.name,
      unit: item.unit ?? null,
      description: item.description ?? null,
      active: true,
    };
  });
}

function counter(prefix: string) {
  let n = 0;
  return () => `${prefix}-${++n}`;
}

describe("varsayılan İKY şablonu", () => {
  const codes = DEFAULT_COST_TEMPLATE.map((item) => item.code);

  it("01–16 ana grupları eksiksiz içerir", () => {
    const roots = codes.filter((code) => parentCodeOf(code) === null);
    expect(roots).toEqual(Array.from({ length: 16 }, (_, i) => String(i + 1).padStart(2, "0")));
  });

  it("yapı denetim ve beton alt kalemlerini içerir", () => {
    for (const code of ["02.07.01", "02.07.02", "02.07.03"]) expect(codes).toContain(code);
    for (let i = 1; i <= 6; i++) expect(codes).toContain(`05.04.0${i}`);
  });

  it("kodlar geçerli, benzersiz ve her alt kalemin üst kalemi var", () => {
    expect(new Set(codes).size).toBe(codes.length);
    for (const code of codes) {
      expect(isValidCode(code)).toBe(true);
      const parent = parentCodeOf(code);
      if (parent) expect(codes).toContain(parent);
    }
  });
});

describe("İKY şablonunun projeye kopyalanması", () => {
  it("tüm kalemleri yeni kimliklerle ve doğru üst kalem bağlantılarıyla kopyalar", () => {
    const sources = templateRows();
    const drafts = planCostTreeCopy(sources, "proje-1", counter("yeni"), true);

    expect(drafts).toHaveLength(sources.length);
    expect(drafts.every((d) => d.projectId === "proje-1")).toBe(true);

    const byId = new Map(drafts.map((d) => [d.id, d]));
    const sourceIds = new Set(sources.map((s) => s.id));
    for (const draft of drafts) {
      // Eski (şablon) kimliklerine bağlantı kalmamalı.
      expect(sourceIds.has(draft.id)).toBe(false);
      const expectedParentCode = parentCodeOf(draft.code);
      if (expectedParentCode === null) {
        expect(draft.parentId).toBeNull();
      } else {
        expect(byId.get(draft.parentId!)?.code).toBe(expectedParentCode);
      }
      // Şablon bağlantısı izlenebilir kalır.
      expect(draft.templateId).toBe(`tpl-${draft.code}`);
    }
  });

  it("üst kalemler alt kalemlerinden önce gelir (tek seferde eklenebilir)", () => {
    const drafts = planCostTreeCopy(templateRows(), "p", counter("x"), true);
    const seen = new Set<string>();
    for (const draft of drafts) {
      if (draft.parentId) expect(seen.has(draft.parentId)).toBe(true);
      seen.add(draft.id);
    }
  });

  it("mevcut projeden kopyalarken pasif kalemleri ve şablon bağlantısını korur", () => {
    const projectItems: CopySource[] = [
      { id: "a", parentId: null, code: "01", name: "Arsa", unit: null, description: null, active: true, templateId: "t01" },
      { id: "b", parentId: "a", code: "01.10", name: "Ek kalem", unit: "götürü", description: null, active: false, templateId: null },
    ];
    const drafts = planCostTreeCopy(projectItems, "p2", counter("y"), false);
    const added = drafts.find((d) => d.code === "01.10")!;
    expect(added.active).toBe(false);
    expect(added.templateId).toBeNull();
    expect(drafts.find((d) => d.code === "01")!.templateId).toBe("t01");
  });

  it("üst kalemi listede olmayan kalemde hata verir", () => {
    const broken: CopySource[] = [
      { id: "z", parentId: "yok", code: "01.01", name: "Yetim", unit: null, description: null, active: true },
    ];
    expect(() => planCostTreeCopy(broken, "p", counter("z"), true)).toThrow(/üst kalemi/);
  });
});

describe("İKY kod işlemleri", () => {
  it("kodları sayısal sıralar", () => {
    const sorted = ["05.04.10", "05.04", "05.04.02", "10", "05", "02.07.01"].sort(compareCodes);
    expect(sorted).toEqual(["02.07.01", "05", "05.04", "05.04.02", "05.04.10", "10"]);
  });

  it("sıradaki alt kodu önerir", () => {
    expect(nextChildCode("05.04", ["05.04.01", "05.04.06", "05.05"])).toBe("05.04.07");
    expect(nextChildCode("02.07", [])).toBe("02.07.01");
    expect(nextChildCode(null, ["01", "16", "05.04"])).toBe("17");
  });

  it("alt kodun üst koda uygunluğunu kontrol eder", () => {
    expect(isDirectChildCode("05.04.07", "05.04")).toBe(true);
    expect(isDirectChildCode("05.05.01", "05.04")).toBe(false);
    expect(isDirectChildCode("05.04.07.01", "05.04")).toBe(false);
    expect(isDirectChildCode("17", null)).toBe(true);
    expect(isDirectChildCode("5.a", null)).toBe(false);
  });

  it("ağaç kurar, alt ve üst kalemleri bulur", () => {
    const rows = [
      { id: "1", parentId: null, code: "05" },
      { id: "3", parentId: "2", code: "05.04.01" },
      { id: "2", parentId: "1", code: "05.04" },
      { id: "4", parentId: "1", code: "05.01" },
    ];
    const tree = buildTree(rows);
    expect(tree).toHaveLength(1);
    expect(tree[0].children.map((c) => c.code)).toEqual(["05.01", "05.04"]);
    expect(descendantIds(rows, "1").sort()).toEqual(["2", "3", "4"]);
    expect(ancestorIds(rows, "3")).toEqual(["2", "1"]);
  });
});
