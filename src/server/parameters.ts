import "server-only";
import Decimal from "decimal.js";
import { ActionError, getAccess, requireGlobalCapability } from "./access";
import { diffFields, writeAudit } from "./audit";
import { db } from "./db";

export type ParameterData = {
  year: number;
  municipality: string | null;
  kind: string;
  value: Decimal;
  unit: string | null;
  description: string | null;
};

export async function listParameters() {
  await requireGlobalCapability("parameters.manage");
  return db.parameter.findMany({ orderBy: [{ kind: "asc" }, { year: "desc" }, { value: "desc" }] });
}

/**
 * Harcama tarihindeki yıl için KDV oranları (parametre tablosundan). O yıl tanımlı değilse
 * tanımlı en yakın önceki yılın oranları kullanılır.
 */
export async function vatRateOptions(year: number): Promise<{ value: string; description: string | null }[]> {
  await getAccess();
  const rows = await db.parameter.findMany({
    where: { kind: "kdv_orani", municipality: null },
    orderBy: [{ year: "desc" }, { value: "desc" }],
  });
  const usableYear = rows.find((row) => row.year <= year)?.year ?? rows[0]?.year;
  return rows
    .filter((row) => row.year === usableYear)
    .map((row) => ({ value: row.value.toString(), description: row.description }));
}

export async function saveParameter(parameterId: string | null, data: ParameterData) {
  const { user } = await requireGlobalCapability("parameters.manage");
  await db.$transaction(async (tx) => {
    if (parameterId) {
      const before = await tx.parameter.findUnique({ where: { id: parameterId } });
      if (!before) throw new ActionError("Parametre bulunamadı.");
      await tx.parameter.update({ where: { id: parameterId }, data });
      await writeAudit(tx, {
        userId: user.id,
        action: "update",
        entity: "Parameter",
        entityId: parameterId,
        changes: diffFields(before, data),
      });
    } else {
      const created = await tx.parameter.create({ data });
      await writeAudit(tx, {
        userId: user.id,
        action: "create",
        entity: "Parameter",
        entityId: created.id,
        changes: { kind: data.kind, year: data.year, value: data.value.toString() },
      });
    }
  });
}

export async function deleteParameter(parameterId: string) {
  const { user } = await requireGlobalCapability("parameters.manage");
  await db.$transaction(async (tx) => {
    const before = await tx.parameter.findUnique({ where: { id: parameterId } });
    if (!before) throw new ActionError("Parametre bulunamadı.");
    await tx.parameter.delete({ where: { id: parameterId } });
    await writeAudit(tx, {
      userId: user.id,
      action: "delete",
      entity: "Parameter",
      entityId: parameterId,
      changes: { kind: before.kind, year: before.year, value: before.value.toString() },
    });
  });
}
