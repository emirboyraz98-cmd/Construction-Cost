import ExcelJS from "exceljs";
import { monthLabel } from "@/lib/cashflow/cashflow";
import { ActionError } from "@/server/access";
import { getCashFlow } from "@/server/cashflow";
import { getSessionUser } from "@/server/session";

const MONEY = "#,##0.00;[Red]-#,##0.00";
const n = (v: { toString(): string }) => Number(v.toString());

/** Proje nakit akışı (Excel). */
export async function GET(_request: Request, { params }: RouteContext<"/api/projects/[projectId]/cash-flow/export">) {
  if (!(await getSessionUser())) return new Response("Oturum açın.", { status: 401 });
  const { projectId } = await params;
  try {
    const data = await getCashFlow(projectId);
    const wb = new ExcelJS.Workbook();
    wb.creator = "İnşaat Maliyet";
    const ws = wb.addWorksheet("Nakit akışı");
    ws.columns = [
      { header: "Ay", key: "month", width: 11 },
      { header: "Durum", key: "state", width: 12 },
      { header: "Harcama", key: "e", width: 14, style: { numFmt: MONEY } },
      { header: "Hakediş", key: "p", width: 14, style: { numFmt: MONEY } },
      { header: "Bağlantı", key: "c", width: 14, style: { numFmt: MONEY } },
      { header: "Planlanan maliyet", key: "pl", width: 16, style: { numFmt: MONEY } },
      { header: "Finansman", key: "f", width: 13, style: { numFmt: MONEY } },
      { header: "Toplam çıkış", key: "out", width: 15, style: { numFmt: MONEY } },
      { header: "Tahsil edilen", key: "col", width: 14, style: { numFmt: MONEY } },
      { header: "Beklenen taksit / çek", key: "inst", width: 16, style: { numFmt: MONEY } },
      { header: "Satış varsayımı", key: "s", width: 15, style: { numFmt: MONEY } },
      { header: "Toplam giriş", key: "in", width: 15, style: { numFmt: MONEY } },
      { header: "Net", key: "net", width: 15, style: { numFmt: MONEY } },
      { header: "Kümülatif", key: "bal", width: 16, style: { numFmt: MONEY } },
    ];
    for (const r of data.flow.rows) {
      ws.addRow({ month: monthLabel(r.month), state: r.past ? "Gerçekleşen" : "Plan", e: n(r.outExpense), p: n(r.outProgress), c: n(r.outConnection), pl: n(r.outPlanned), f: n(r.outFinancing), out: n(r.outTotal), col: n(r.inCollected), inst: n(r.inScheduled), s: n(r.inSales), in: n(r.inTotal), net: n(r.net), bal: n(r.balance) });
    }
    ws.getRow(1).font = { bold: true };
    ws.views = [{ state: "frozen", ySplit: 1, xSplit: 1 }];
    const sum = wb.addWorksheet("Özet");
    const o = data.outcome;
    for (const [k, v] of [
      ["Toplam giriş", data.flow.totalIn],
      ["Toplam çıkış", data.flow.totalOut],
      ["En yüksek nakit ihtiyacı", o.peakNeed],
      ["Finansman maliyeti", data.flow.financingCost],
      ["Maliyet (KDV hariç)", o.cost],
      ["Gelir (KDV hariç)", o.revenue],
      ["Komisyon", o.commission],
      ["Beklenen kâr (KDV hariç, finansman dahil)", o.profit],
    ] as const) {
      const row = sum.addRow([k, n(v)]);
      row.getCell(2).numFmt = MONEY;
    }
    sum.getColumn(1).width = 42;
    sum.getColumn(2).width = 18;
    const buffer = await wb.xlsx.writeBuffer();
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="nakit-akisi_${new Date().toISOString().slice(0, 10)}.xlsx"`,
      },
    });
  } catch (error) {
    if (error instanceof ActionError) return new Response(error.message, { status: 403 });
    throw error;
  }
}
