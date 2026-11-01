"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { PaymentMethod } from "@/generated/prisma/enums";
import { dateInputToDate } from "@/lib/format";
import { toActionResult } from "@/server/action-error";
import { setConnectionPaymentsPaid } from "@/server/connections";
import { setBillingsPaid } from "@/server/contracts";
import { setPaymentStatus } from "@/server/expenses";

const keys = z.array(z.string().regex(/^(expense|connection|billing):[\w-]{1,100}$/)).min(1).max(500);

/** Vade listesinden toplu ödendi: harcama, bağlantı ödemesi ve hakediş birlikte seçilebilir. */
export async function markPayablesPaidAction(input: { keys: string[]; paidAt: string; method: string | null }) {
  try {
    const parsed = keys.parse(input.keys);
    const paidAt = dateInputToDate(input.paidAt) ?? new Date();
    const method = input.method ? z.enum(PaymentMethod).parse(input.method) : null;
    const of = (source: string) => parsed.filter((k) => k.startsWith(`${source}:`)).map((k) => k.slice(source.length + 1));
    let count = 0;
    if (of("expense").length) count += await setPaymentStatus(of("expense"), { paid: true, paidAt, method });
    if (of("connection").length) count += await setConnectionPaymentsPaid(of("connection"), { paid: true, paidAt, method, exchangeRate: null });
    if (of("billing").length) count += await setBillingsPaid(of("billing"), { paid: true, paidAt, method });
    revalidatePath("/", "layout");
    return { ok: true as const, count };
  } catch (error) {
    return toActionResult(error);
  }
}
