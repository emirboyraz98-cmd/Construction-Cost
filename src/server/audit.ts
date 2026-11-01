import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import type { Tx } from "./db";

type AuditEntry = {
  userId: string | null;
  projectId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  changes?: Prisma.InputJsonValue;
};

export async function writeAudit(tx: Tx, entry: AuditEntry): Promise<void> {
  await tx.auditLog.create({
    data: {
      userId: entry.userId,
      projectId: entry.projectId ?? null,
      action: entry.action,
      entity: entry.entity,
      entityId: entry.entityId ?? null,
      changes: entry.changes,
    },
  });
}

function comparable(value: unknown): string | null {
  if (value == null) return null;
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

/** Değişen alanlar: { alan: { old, new } } (Decimal ve tarihler metne çevrilir). */
export function diffFields(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): Record<string, { old: string | null; new: string | null }> {
  const changes: Record<string, { old: string | null; new: string | null }> = {};
  for (const key of Object.keys(after)) {
    const oldValue = comparable(before[key]);
    const newValue = comparable(after[key]);
    if (oldValue !== newValue) changes[key] = { old: oldValue, new: newValue };
  }
  return changes;
}
