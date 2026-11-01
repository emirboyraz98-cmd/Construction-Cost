// Bütçe: satır tutarı, kalem/grup toplamları, blok dağılımı ve m² maliyetleri (PLAN.md 7.1–7.3; saf modül).
import Decimal from "decimal.js";
import { roundMoney } from "../expenses/amounts";
import { allocateByWeights } from "../expenses/split";

const zero = () => new Decimal(0);

/** Kalem maliyeti = miktar × birim fiyat (TL) × (1 + fire %), kuruşa yuvarlanmış. */
export function lineAmount(quantity: Decimal, unitPriceTry: Decimal, wastePercent: Decimal): Decimal {
  return roundMoney(quantity.times(unitPriceTry).times(wastePercent.div(100).plus(1)));
}

/** Yapım maliyeti grupları (PLAN 7.3: inşaat m² maliyeti yalnızca yapım kalemleriyle). */
export const CONSTRUCTION_GROUPS = ["04", "05", "06", "07", "08", "09", "10", "11", "12"] as const;

export const topCode = (code: string) => code.split(".")[0];

export type BudgetRow = { costItemCode: string; blockId: string | null; amount: Decimal };

export type BudgetSummary = {
  total: Decimal;
  construction: Decimal;
  byGroup: Map<string, Decimal>;
  /** Blok: kendi satırları + ortak satırların inşaat alanı oranında payı */
  byBlock: { blockId: string; direct: Decimal; common: Decimal; total: Decimal }[];
  commonTotal: Decimal;
};

export function summarizeBudget(rows: readonly BudgetRow[], blocks: readonly { id: string; constructionArea: Decimal }[]): BudgetSummary {
  const byGroup = new Map<string, Decimal>();
  const direct = new Map<string, Decimal>(blocks.map((b) => [b.id, zero()]));
  let total = zero();
  let construction = zero();
  let commonTotal = zero();
  for (const row of rows) {
    const group = topCode(row.costItemCode);
    byGroup.set(group, (byGroup.get(group) ?? zero()).plus(row.amount));
    total = total.plus(row.amount);
    if ((CONSTRUCTION_GROUPS as readonly string[]).includes(group)) construction = construction.plus(row.amount);
    if (row.blockId && direct.has(row.blockId)) direct.set(row.blockId, direct.get(row.blockId)!.plus(row.amount));
    else commonTotal = commonTotal.plus(row.amount);
  }
  const weights = blocks.map((b) => b.constructionArea);
  const canSplit = blocks.length > 0 && weights.some((w) => w.gt(0)) && commonTotal.gt(0);
  const shares = canSplit ? allocateByWeights(commonTotal, weights) : blocks.map(() => zero());
  return {
    total,
    construction,
    byGroup,
    commonTotal,
    byBlock: blocks.map((b, i) => {
      const own = direct.get(b.id) ?? zero();
      return { blockId: b.id, direct: own, common: shares[i], total: own.plus(shares[i]) };
    }),
  };
}

export type SquareMeterCosts = {
  /** İnşaat m² maliyeti = yapım maliyeti / toplam inşaat alanı (teknik kıyas) */
  construction: Decimal | null;
  /** Toplam maliyet / toplam inşaat alanı */
  totalPerConstruction: Decimal | null;
  /** Müteahhit satılabilir m² maliyeti = toplam maliyet / müteahhide kalan brüt m² */
  contractorSellable: Decimal | null;
};

const per = (amount: Decimal, area: Decimal) => (area.gt(0) ? roundMoney(amount.div(area)) : null);

/**
 * Kat karşılığında toplam maliyet tüm binayı, gelir yalnızca müteahhit bölümlerini kapsar
 * (PLAN 7.3); bu yüzden satılabilir m² maliyeti müteahhide kalan alana bölünür.
 */
export function squareMeterCosts(
  summary: Pick<BudgetSummary, "total" | "construction">,
  areas: { constructionArea: Decimal; contractorGross: Decimal },
): SquareMeterCosts {
  return {
    construction: per(summary.construction, areas.constructionArea),
    totalPerConstruction: per(summary.total, areas.constructionArea),
    contractorSellable: per(summary.total, areas.contractorGross),
  };
}
