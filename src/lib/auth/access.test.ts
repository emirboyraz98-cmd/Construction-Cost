import { describe, expect, it } from "vitest";
import {
  canInProject,
  canSeeProject,
  filterVisibleProjects,
  projectRole,
  projectWhere,
  resolveAccessScope,
} from "./access";

const projects = [
  { id: "kadikoy", name: "Kadıköy Konutları" },
  { id: "camlik", name: "Çamlık Villaları" },
  { id: "merkez", name: "Merkez Ofis" },
];

describe("proje yetki filtresi", () => {
  it("şantiye şefi yalnızca yetkili olduğu projeyi görür, diğerlerini göremez", () => {
    const scope = resolveAccessScope({ id: "u1", role: "santiye_sefi", active: true }, [
      { projectId: "kadikoy", role: "santiye_sefi" },
    ]);

    expect(canSeeProject(scope, "kadikoy")).toBe(true);
    expect(canSeeProject(scope, "camlik")).toBe(false);
    expect(canSeeProject(scope, "merkez")).toBe(false);
    expect(filterVisibleProjects(scope, projects).map((p) => p.id)).toEqual(["kadikoy"]);
    // Veritabanı sorgusuna giden filtre de yalnızca yetkili projeyi içerir.
    expect(projectWhere(scope)).toEqual({ id: { in: ["kadikoy"] } });
  });

  it("yetkisi olmayan kullanıcı hiçbir projeyi göremez", () => {
    const scope = resolveAccessScope({ id: "u2", role: "satis", active: true }, []);
    expect(filterVisibleProjects(scope, projects)).toEqual([]);
    expect(projectWhere(scope)).toEqual({ id: { in: [] } });
  });

  it("yönetici tüm projeleri görür ve filtre uygulanmaz", () => {
    const scope = resolveAccessScope({ id: "admin", role: "yonetici", active: true }, []);
    expect(filterVisibleProjects(scope, projects)).toHaveLength(3);
    expect(projectWhere(scope)).toEqual({});
    expect(projectRole(scope, "camlik")).toBe("yonetici");
  });

  it("pasif kullanıcı (yönetici olsa bile) hiçbir projeyi göremez", () => {
    const scope = resolveAccessScope({ id: "old", role: "yonetici", active: false }, [
      { projectId: "kadikoy", role: "teknik_ofis" },
    ]);
    expect(filterVisibleProjects(scope, projects)).toEqual([]);
    expect(projectWhere(scope)).toEqual({ id: { in: [] } });
  });

  it("projedeki rol, o projede neler yapılabileceğini belirler", () => {
    const scope = resolveAccessScope({ id: "u3", role: "teknik_ofis", active: true }, [
      { projectId: "kadikoy", role: "teknik_ofis" },
      { projectId: "camlik", role: "satis" },
    ]);

    expect(canInProject(scope, "kadikoy", "costTree.edit")).toBe(true);
    // Satış rolü maliyet detayını görmez.
    expect(canInProject(scope, "camlik", "costTree.view")).toBe(false);
    // Yetkisiz projede hiçbir şey yapılamaz.
    expect(canInProject(scope, "merkez", "costTree.view")).toBe(false);
  });

  it("şantiye şefi maliyet ağacını görebilir ama değiştiremez", () => {
    const scope = resolveAccessScope({ id: "u1", role: "santiye_sefi", active: true }, [
      { projectId: "kadikoy", role: "santiye_sefi" },
    ]);
    expect(canInProject(scope, "kadikoy", "costTree.view")).toBe(true);
    expect(canInProject(scope, "kadikoy", "costTree.edit")).toBe(false);
    expect(canInProject(scope, "kadikoy", "project.edit")).toBe(false);
  });
});
