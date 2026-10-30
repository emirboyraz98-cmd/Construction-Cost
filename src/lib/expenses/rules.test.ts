import { describe, expect, it } from "vitest";
import { canModifyExpense, expenseVisibility, initialApprovalStatus } from "./access";
import { filtersToSearchParams, hasActiveFilters, parseExpenseFilters } from "./filters";
import { addDays, dueBucket } from "./payables";

describe("harcama görünürlüğü ve yetki", () => {
  it("şantiye şefi yalnızca kendi girişlerini görür, ofis hepsini", () => {
    expect(expenseVisibility("santiye_sefi", "u1")).toEqual({ createdById: "u1" });
    expect(expenseVisibility("muhasebe", "u1")).toEqual({});
    expect(expenseVisibility("dis_muhasebeci", "u1")).toEqual({});
    expect(expenseVisibility("satis", "u1")).toBeNull();
    expect(expenseVisibility(null, "u1")).toBeNull();
  });

  it("onay yetkisi olanın kaydı onaylı başlar", () => {
    expect(initialApprovalStatus("yonetici")).toBe("APPROVED");
    expect(initialApprovalStatus("muhasebe")).toBe("APPROVED");
    expect(initialApprovalStatus("santiye_sefi")).toBe("PENDING");
    expect(initialApprovalStatus("satin_alma")).toBe("PENDING");
  });

  it("giren kişi onaylanmış kaydını değiştiremez; ofis her kaydı değiştirebilir", () => {
    const own = { createdById: "u1", approvalStatus: "PENDING" as const, kind: "EXPENSE" as const };
    expect(canModifyExpense("santiye_sefi", "u1", own)).toBe(true);
    expect(canModifyExpense("santiye_sefi", "u1", { ...own, approvalStatus: "REJECTED" })).toBe(true);
    expect(canModifyExpense("santiye_sefi", "u1", { ...own, approvalStatus: "APPROVED" })).toBe(false);
    expect(canModifyExpense("santiye_sefi", "u2", own)).toBe(false);
    expect(canModifyExpense("muhasebe", "u2", { ...own, approvalStatus: "APPROVED" })).toBe(true);
    expect(canModifyExpense("teknik_ofis", "u1", own)).toBe(false);
    // hakediş ve transfer satırları kendi ekranlarından yönetilir
    expect(canModifyExpense("yonetici", "u1", { ...own, kind: "PROGRESS" })).toBe(false);
    expect(canModifyExpense("yonetici", "u1", { ...own, kind: "TRANSFER" })).toBe(false);
    expect(canModifyExpense("santiye_sefi", "u1", { ...own, kind: "DELIVERY" })).toBe(true);
  });
});

describe("liste filtreleri", () => {
  it("geçersiz değerleri yok sayar", () => {
    const f = parseExpenseFilters({ status: "BOGUS", payment: "PAID", page: "-3", from: "2026-13-40", q: "  " });
    expect(f.status).toBeNull();
    expect(f.payment).toBe("PAID");
    expect(f.page).toBe(1);
    expect(f.from).toBeNull();
    expect(f.query).toBeNull();
    expect(hasActiveFilters(f)).toBe(true);
    expect(hasActiveFilters(parseExpenseFilters({ page: "4" }))).toBe(false);
  });

  it("adres parametrelerine gidip geri döner", () => {
    const params = { from: "2026-01-01", to: "2026-03-31", item: "c1", status: "PENDING", nodoc: "1", q: "çimento", page: "2" };
    const back = Object.fromEntries(filtersToSearchParams(parseExpenseFilters(params)));
    expect(back).toEqual(params);
  });
});

describe("vade grupları", () => {
  const today = new Date("2026-10-30T15:00:00Z");
  it("gün sınırlarını doğru ayırır", () => {
    expect(dueBucket(null, today)).toBe("noDueDate");
    expect(dueBucket(new Date("2026-10-29"), today)).toBe("overdue");
    expect(dueBucket(new Date("2026-10-30"), today)).toBe("thisWeek");
    expect(dueBucket(addDays(today, 6), today)).toBe("thisWeek");
    expect(dueBucket(addDays(today, 7), today)).toBe("later");
  });
});
