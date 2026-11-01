// Bağımsız bölüm kontrolleri ve toplu üretim (PLAN.md 5.5, 15; saf modül).
import Decimal from "decimal.js";
import type { UnitOwner, UsageType } from "@/generated/prisma/enums";
import { formatNumber } from "../format";

const zero = () => new Decimal(0);

export type UnitRef = { blockId: string; grossArea: Decimal; netArea: Decimal; owner: UnitOwner; landownerId: string | null };

/** Arsa sahibi payı ↔ işaretli bölümler arasında kabul edilen fark (yüzde puan). */
export const SHARE_TOLERANCE = new Decimal("0.5");

export type AreaCheck = { level: "danger" | "warning" | "info"; scope: "block" | "landowner"; message: string };

export function areaChecks(
  blocks: readonly { id: string; name: string; constructionArea: Decimal | null }[],
  units: readonly UnitRef[],
  landowners: readonly { id: string; name: string; sharePercent: Decimal }[],
): AreaCheck[] {
  const checks: AreaCheck[] = [];
  for (const block of blocks) {
    const own = units.filter((u) => u.blockId === block.id);
    if (own.length === 0) continue;
    const gross = own.reduce((s, u) => s.plus(u.grossArea), zero());
    const net = own.reduce((s, u) => s.plus(u.netArea), zero());
    if (own.some((u) => u.netArea.gt(u.grossArea))) checks.push({ level: "danger", scope: "block", message: `${block.name}: net alanı brütten büyük bölüm var.` });
    if (!block.constructionArea || block.constructionArea.isZero()) {
      checks.push({ level: "warning", scope: "block", message: `${block.name}: blok inşaat alanı girilmemiş; bölüm alanları karşılaştırılamıyor.` });
    } else if (gross.gt(block.constructionArea)) {
      checks.push({
        level: "danger",
        scope: "block",
        message: `${block.name}: bölümlerin brüt toplamı (${formatNumber(gross)} m²) blok inşaat alanını (${formatNumber(block.constructionArea)} m²) aşıyor.`,
      });
    } else {
      checks.push({
        level: "info",
        scope: "block",
        message: `${block.name}: brüt ${formatNumber(gross)} m² / inşaat ${formatNumber(block.constructionArea)} m² (%${formatNumber(gross.div(block.constructionArea).times(100), 1)}), net ${formatNumber(net)} m².`,
      });
    }
  }

  const total = units.reduce((s, u) => s.plus(u.grossArea), zero());
  if (units.some((u) => u.owner === "LANDOWNER" && !u.landownerId)) {
    checks.push({ level: "warning", scope: "landowner", message: "Arsa sahibine işaretlenip kişisi seçilmemiş bölüm var." });
  }
  if (total.gt(0)) {
    for (const owner of landowners) {
      const marked = units.filter((u) => u.owner === "LANDOWNER" && u.landownerId === owner.id).reduce((s, u) => s.plus(u.grossArea), zero());
      const pct = marked.div(total).times(100);
      const diff = pct.minus(owner.sharePercent);
      const text = `${owner.name}: sözleşme %${formatNumber(owner.sharePercent, 2)}, işaretlenen bölümler %${formatNumber(pct, 2)} (${formatNumber(marked)} m²)`;
      if (diff.abs().gt(SHARE_TOLERANCE)) {
        checks.push({ level: "danger", scope: "landowner", message: `${text}; fark ${formatNumber(diff.abs(), 2)} puan ${diff.isPositive() ? "fazla" : "eksik"}.` });
      } else {
        checks.push({ level: "info", scope: "landowner", message: `${text}.` });
      }
    }
  }
  return checks;
}

export type UnitDraft = {
  blockId: string;
  floor: number;
  doorNo: string;
  usageType: UsageType;
  layout: string | null;
  netArea: Decimal;
  grossArea: Decimal;
};

/** Kat kat bölüm üretir: her katta `perFloor` bölüm, kapı no sırayla `startNo`'dan. */
export function generateUnits(spec: {
  blockId: string;
  fromFloor: number;
  toFloor: number;
  perFloor: number;
  startNo: number;
  usageType: UsageType;
  layout: string | null;
  netArea: Decimal;
  grossArea: Decimal;
}): UnitDraft[] {
  const rows: UnitDraft[] = [];
  let no = spec.startNo;
  for (let floor = spec.fromFloor; floor <= spec.toFloor; floor++) {
    for (let i = 0; i < spec.perFloor; i++) {
      rows.push({ blockId: spec.blockId, floor, doorNo: String(no++), usageType: spec.usageType, layout: spec.layout, netArea: spec.netArea, grossArea: spec.grossArea });
    }
  }
  return rows;
}
