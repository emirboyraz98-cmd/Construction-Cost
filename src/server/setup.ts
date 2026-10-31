import "server-only";
import type { Role } from "@/generated/prisma/enums";
import { hasCapability } from "@/lib/auth/roles";
import { db } from "./db";

// Proje kurulum adımları (sadeleştirme): yeni projede "sırada ne var" listesi.

export type SetupStep = { key: string; label: string; hint: string; done: boolean; href: string };

export async function projectSetupSteps(projectId: string, role: Role): Promise<SetupStep[] | null> {
  if (!hasCapability(role, "project.edit") && !hasCapability(role, "budget.edit")) return null;
  const base = `/projects/${projectId}`;
  const [project, blocks, units, landowners, budgetLines, priceLists, team, schedule, cashSetting] = await Promise.all([
    db.project.findUnique({ where: { id: projectId }, select: { landModel: true, startDate: true, durationMonths: true } }),
    db.block.count({ where: { projectId } }),
    db.unit.count({ where: { projectId } }),
    db.landowner.count({ where: { projectId } }),
    db.budgetLine.count({ where: { projectId } }),
    db.priceList.count({ where: { projectId } }),
    db.projectPermission.count({ where: { projectId } }),
    db.scheduleEntry.count({ where: { projectId } }),
    db.cashFlowSetting.count({ where: { projectId } }),
  ]);
  if (!project) return null;
  const steps: SetupStep[] = [
    { key: "info", label: "Başlangıç tarihi ve süre", hint: "Nakit akışı ve iş programı için gerekli.", done: Boolean(project.startDate && project.durationMonths), href: `${base}/edit` },
    { key: "blocks", label: "Bloklar", hint: "Kat adedi ve inşaat alanı.", done: blocks > 0, href: `${base}/blocks` },
    { key: "units", label: "Bağımsız bölümler", hint: "“Kat kat üret” ile hızlıca.", done: units > 0, href: `${base}/units` },
    ...(project.landModel !== "PURCHASE" ? [{ key: "land", label: "Arsa sahipleri ve payları", hint: "Kat karşılığında arsa sahibine düşen bölümler.", done: landowners > 0, href: `${base}/land` }] : []),
    { key: "team", label: "Ekip (kullanıcı yetkileri)", hint: "Şantiye şefi, muhasebe, satış ekibi.", done: team > 0, href: "/settings/users" },
    { key: "budget", label: "Bütçe", hint: "Metraj → bütçe; m² maliyeti çıkar.", done: budgetLines > 0, href: `${base}/budget` },
    { key: "prices", label: "Fiyat listesi", hint: "Kâr ve komisyonla bölüm fiyatları; onaylayınca satış ekibi görür.", done: priceLists > 0, href: `${base}/pricing` },
    { key: "cash", label: "İş programı ve nakit varsayımları", hint: "Aylık nakit ihtiyacını görmek için.", done: schedule > 0 && cashSetting > 0, href: `${base}/cash-flow` },
  ];
  return steps;
}
