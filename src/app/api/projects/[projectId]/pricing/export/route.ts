import ExcelJS from "exceljs";
import { FLOOR_LABEL, USAGE_TYPE_LABELS } from "@/lib/budget/labels";
import { ActionError } from "@/server/access";
import { getPriceListExport } from "@/server/pricing";
import { getSessionUser } from "@/server/session";

const MONEY = "#,##0.00";
const num = (v: { toString(): string } | null | undefined) => (v == null ? null : Number(v.toString()));

/** Bağımsız bölüm fiyat listesi (Excel): onaylı liste veya ?taslak=1 ile canlı hesap. */
export async function GET(request: Request, { params }: RouteContext<"/api/projects/[projectId]/pricing/export">) {
  if (!(await getSessionUser())) return new Response("Oturum açın.", { status: 401 });
  const { projectId } = await params;
  const draft = new URL(request.url).searchParams.get("taslak") === "1";
  try {
    const data = await getPriceListExport(projectId, draft);
    const wb = new ExcelJS.Workbook();
    wb.creator = "İnşaat Maliyet";
    const ws = wb.addWorksheet("Fiyat listesi");
    ws.addRow([`${data.projectName} – Bağımsız bölüm fiyat listesi`]).font = { bold: true, size: 13 };
    ws.addRow([data.subtitle]);
    ws.addRow([]);
    const header = ws.addRow(["Blok", "Kat", "Kapı no", "Kullanım", "Tip", "Cephe", "Manzara", "Net m²", "Brüt m²", "Fiyat (KDV hariç)", "KDV %", "Fiyat (KDV dahil)", "Brüt m² fiyatı", "Not"]);
    header.font = { bold: true };
    for (const r of data.contractor) {
      ws.addRow([
        r.unit.block.name,
        FLOOR_LABEL(r.unit.floor),
        r.unit.doorNo,
        USAGE_TYPE_LABELS[r.unit.usageType],
        r.unit.layout ?? "",
        r.unit.facade ?? "",
        r.unit.view ?? "",
        num(r.unit.netArea),
        num(r.unit.grossArea),
        num(r.price),
        num(r.vatRate),
        num(r.priceWithVat),
        num(r.perM2),
        r.unit.priceLocked ? "Kilitli" : "",
      ]);
    }
    const total = ws.addRow(["TOPLAM", "", "", "", "", "", "", null, null, num(data.total), null, num(data.totalWithVat)]);
    total.font = { bold: true };
    [8, 9].forEach((c) => (ws.getColumn(c).numFmt = "#,##0.00"));
    [10, 12, 13].forEach((c) => (ws.getColumn(c).numFmt = MONEY));
    ws.columns.forEach((col, i) => (col.width = [10, 10, 8, 10, 10, 8, 12, 9, 9, 18, 7, 18, 14, 9][i]));
    ws.views = [{ state: "frozen", ySplit: 4 }];
    if (data.landowner.length) {
      const lo = wb.addWorksheet("Arsa sahibi bölümleri");
      lo.addRow(["Blok", "Kat", "Kapı no", "Kullanım", "Net m²", "Brüt m²", "Arsa sahibi"]).font = { bold: true };
      for (const r of data.landowner) lo.addRow([r.unit.block.name, FLOOR_LABEL(r.unit.floor), r.unit.doorNo, USAGE_TYPE_LABELS[r.unit.usageType], num(r.unit.netArea), num(r.unit.grossArea), r.unit.landowner?.name ?? ""]);
      lo.columns.forEach((col) => (col.width = 14));
    }
    const buffer = await wb.xlsx.writeBuffer();
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="fiyat-listesi${draft ? "-taslak" : ""}_${new Date().toISOString().slice(0, 10)}.xlsx"`,
      },
    });
  } catch (error) {
    if (error instanceof ActionError) return new Response(error.message, { status: 403 });
    throw error;
  }
}
