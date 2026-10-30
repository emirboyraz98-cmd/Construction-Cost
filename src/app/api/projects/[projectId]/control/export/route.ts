import ExcelJS from "exceljs";
import { ActionError } from "@/server/access";
import { getBudgetControl } from "@/server/control";
import { getSessionUser } from "@/server/session";

const MONEY = "#,##0.00;[Red]-#,##0.00";
const num = (v: { toString(): string } | null | undefined) => (v == null ? null : Number(v.toString()));

/** Bütçe kontrol tablosu (Excel). */
export async function GET(request: Request, { params }: RouteContext<"/api/projects/[projectId]/control/export">) {
  if (!(await getSessionUser())) return new Response("Oturum açın.", { status: 401 });
  const { projectId } = await params;
  try {
    const data = await getBudgetControl(projectId, new URL(request.url).searchParams.get("baz"));
    const wb = new ExcelJS.Workbook();
    wb.creator = "İnşaat Maliyet";
    const ws = wb.addWorksheet("Bütçe kontrolü");
    ws.columns = [
      { header: "Kod", key: "code", width: 10 },
      { header: "Kalem", key: "name", width: 44 },
      { header: "Baz bütçe", key: "baseline", width: 15, style: { numFmt: MONEY } },
      { header: "Güncel bütçe", key: "budget", width: 15, style: { numFmt: MONEY } },
      { header: "Gerçekleşen", key: "actual", width: 15, style: { numFmt: MONEY } },
      { header: "Tamamlanma %", key: "percent", width: 12 },
      { header: "Kaynak", key: "source", width: 10 },
      { header: "EAC", key: "eac", width: 15, style: { numFmt: MONEY } },
      { header: "Sapma (referans − EAC)", key: "variance", width: 18, style: { numFmt: MONEY } },
      { header: "Durum", key: "status", width: 16 },
    ];
    const statusText = { over: "Aşıldı", risk: "Aşım bekleniyor", unbudgeted: "Bütçesiz", ok: "" } as const;
    for (const r of data.rows.filter((x) => x.hasData)) {
      const row = ws.addRow({
        code: r.code,
        name: `${"  ".repeat(r.depth)}${r.name}`,
        baseline: num(r.baseline),
        budget: num(r.budget),
        actual: num(r.actual),
        percent: num(r.control.percent),
        source: r.control.percentSource === "manual" ? "elle" : r.control.percentSource === "quantity" ? "miktar" : "",
        eac: num(r.control.eac),
        variance: num(r.control.variance),
        status: statusText[r.control.status],
      });
      if (r.depth === 0) row.font = { bold: true };
    }
    const total = ws.addRow({ name: "TOPLAM", baseline: data.totals.hasBaseline ? num(data.totals.baseline) : null, budget: num(data.totals.budget), actual: num(data.totals.actual), percent: num(data.totals.progress), eac: num(data.totals.eac), variance: num(data.totals.variance) });
    total.font = { bold: true };
    ws.getRow(1).font = { bold: true };
    ws.views = [{ state: "frozen", ySplit: 1 }];
    const buffer = await wb.xlsx.writeBuffer();
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="butce-kontrolu_${new Date().toISOString().slice(0, 10)}.xlsx"`,
      },
    });
  } catch (error) {
    if (error instanceof ActionError) return new Response(error.message, { status: 403 });
    throw error;
  }
}
