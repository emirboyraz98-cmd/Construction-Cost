import { describe, expect, it } from "vitest";
import { canModifyExpense, expenseVisibility, initialApprovalStatus } from "../expenses/access";
import {
  canInProject,
  canSeeProject,
  filterVisibleProjects,
  projectIdsWithCapability,
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

describe("harcama görünürlüğü ve düzeltme yetkisi", () => {
  it("şantiye şefi yalnızca kendi girdiği harcamaları görür; satış hiç göremez", () => {
    expect(expenseVisibility("santiye_sefi", "u1")).toEqual({ createdById: "u1" });
    expect(expenseVisibility("muhasebe", "u2")).toEqual({});
    expect(expenseVisibility("satis", "u3")).toBeNull();
  });

  it("giren kişi onaylanmamış kaydını düzeltir; onaylananı yalnızca ofis düzeltir", () => {
    const pending = { createdById: "u1", approvalStatus: "PENDING" as const };
    const approved = { createdById: "u1", approvalStatus: "APPROVED" as const };
    expect(canModifyExpense("santiye_sefi", "u1", pending)).toBe(true);
    expect(canModifyExpense("santiye_sefi", "u1", approved)).toBe(false);
    expect(canModifyExpense("santiye_sefi", "u9", pending)).toBe(false);
    expect(canModifyExpense("muhasebe", "u2", approved)).toBe(true);
    expect(canModifyExpense("dis_muhasebeci", "u4", pending)).toBe(false);
  });

  it("şantiyeden girilen harcama onay bekler, ofisin girdiği onaylı başlar", () => {
    expect(initialApprovalStatus("santiye_sefi")).toBe("PENDING");
    expect(initialApprovalStatus("muhasebe")).toBe("APPROVED");
  });
});

describe("şirket geneli harcama listelerinin proje filtresi", () => {
  it("yalnızca kullanıcının o projede yetkisi olan projeler girer", () => {
    const scope = resolveAccessScope({ id: "u5", role: "muhasebe", active: true }, [
      { projectId: "kadikoy", role: "muhasebe" },
      { projectId: "camlik", role: "santiye_sefi" },
    ]);
    expect(projectIdsWithCapability(scope, "expense.viewAll")).toEqual({ projectId: { in: ["kadikoy"] } });
    expect(projectIdsWithCapability(scope, "expense.create")).toEqual({
      projectId: { in: ["kadikoy", "camlik"] },
    });
  });

  it("yönetici için filtre yok", () => {
    const scope = resolveAccessScope({ id: "a", role: "yonetici", active: true }, []);
    expect(projectIdsWithCapability(scope, "accountant.export")).toEqual({});
  });
});
