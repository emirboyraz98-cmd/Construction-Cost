import { describe, expect, it } from "vitest";
import { closeTab, moveTab, normalizeTabs, openTab, tabAfterClose, type Tab } from "./tabs";

const ids = (tabs: Tab[]) => tabs.map((tab) => tab.projectId);

const initial: Tab[] = [
  { projectId: "b", position: 5 },
  { projectId: "a", position: 1 },
  { projectId: "c", position: 9 },
];

describe("proje sekmeleri", () => {
  it("konuma göre sıralar ve 0'dan başlayarak numaralar", () => {
    expect(normalizeTabs(initial)).toEqual([
      { projectId: "a", position: 0 },
      { projectId: "b", position: 1 },
      { projectId: "c", position: 2 },
    ]);
  });

  it("yeni proje en sona eklenir; zaten açıksa tekrar eklenmez", () => {
    const opened = openTab(initial, "d");
    expect(ids(opened)).toEqual(["a", "b", "c", "d"]);
    expect(opened.at(-1)).toEqual({ projectId: "d", position: 3 });
    expect(ids(openTab(opened, "b"))).toEqual(["a", "b", "c", "d"]);
  });

  it("kapatılan sekme çıkarılır, kalanların sırası korunur", () => {
    expect(closeTab(initial, "b")).toEqual([
      { projectId: "a", position: 0 },
      { projectId: "c", position: 1 },
    ]);
    // Kapatılıp yeniden açılan proje en sona gelir.
    expect(ids(openTab(closeTab(initial, "a"), "a"))).toEqual(["b", "c", "a"]);
  });

  it("sürükle-bırak ile sekme taşınır", () => {
    expect(ids(moveTab(initial, "c", 0))).toEqual(["c", "a", "b"]);
    expect(ids(moveTab(initial, "a", 2))).toEqual(["b", "c", "a"]);
    expect(ids(moveTab(initial, "a", 99))).toEqual(["b", "c", "a"]);
    expect(ids(moveTab(initial, "yok", 0))).toEqual(["a", "b", "c"]);
  });

  it("açık sekme kapatılınca sağdaki, yoksa soldaki sekmeye geçilir", () => {
    expect(tabAfterClose(initial, "a")).toBe("b");
    expect(tabAfterClose(initial, "c")).toBe("b");
    expect(tabAfterClose([{ projectId: "a", position: 0 }], "a")).toBeNull();
  });
});
