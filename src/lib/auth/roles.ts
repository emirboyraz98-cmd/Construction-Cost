// Roller ve yetenekler (PLAN.md Bölüm 2). Saf modül; hem sunucuda hem tarayıcıda kullanılır.
import { Role } from "@/generated/prisma/enums";

export { Role };

export const ROLES = Object.values(Role) as Role[];

export const ROLE_LABELS: Record<Role, string> = {
  yonetici: "Yönetici",
  teknik_ofis: "Teknik ofis",
  santiye_sefi: "Şantiye şefi",
  muhasebe: "Muhasebe",
  satin_alma: "Satın alma",
  satis: "Satış",
  dis_muhasebeci: "Dış muhasebeci",
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  yonetici: "Her şey; tüm projeleri görür, kullanıcıları yönetir",
  teknik_ofis: "Bina bilgileri, metraj, birim fiyat, bütçe",
  santiye_sefi: "Kendi projesine harcama girişi; fiyat/kâr bilgisini görmez",
  muhasebe: "Harcama girişi ve onayı, ödemeler, tedarikçi cari",
  satin_alma: "Malzeme bağlantıları, teklifler, tedarikçiler, teslimatlar",
  satis: "Fiyat listesi, müşteri, satış, tahsilat; maliyet detayını görmez",
  dis_muhasebeci: "Salt okunur; dönemsel Excel paketi",
};

/** Projeye özel yetki verilirken seçilebilen roller (yönetici zaten tüm projeleri görür). */
export const PROJECT_ROLES: readonly Role[] = ROLES.filter((role) => role !== Role.yonetici);

export type Capability =
  | "project.create"
  | "project.edit"
  | "project.viewTeam"
  | "blocks.edit"
  | "costTree.view"
  | "costTree.edit"
  | "users.manage";

const CAPABILITIES: Record<Capability, readonly Role[]> = {
  "project.create": [Role.yonetici, Role.teknik_ofis],
  "project.edit": [Role.yonetici, Role.teknik_ofis],
  "project.viewTeam": [Role.yonetici],
  "blocks.edit": [Role.yonetici, Role.teknik_ofis],
  "costTree.view": [
    Role.yonetici,
    Role.teknik_ofis,
    Role.santiye_sefi,
    Role.muhasebe,
    Role.satin_alma,
    Role.dis_muhasebeci,
  ],
  "costTree.edit": [Role.yonetici, Role.teknik_ofis],
  "users.manage": [Role.yonetici],
};

export function hasCapability(role: Role | null | undefined, capability: Capability): boolean {
  return role != null && CAPABILITIES[capability].includes(role);
}
