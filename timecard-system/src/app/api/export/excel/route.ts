import { NextResponse } from "next/server";
import { getSessionUser, requireManager } from "@/lib/session";
import { queryAttendance, resolveStoreScope } from "@/lib/attendance";
import { buildWorkbook } from "@/lib/export";
import { thisMonthJst } from "@/lib/time";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  if (!(await getSessionUser())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const user = await requireManager();
  const url = new URL(req.url);
  const monthParam = url.searchParams.get("month") ?? "";
  const month = /^\d{4}-\d{2}$/.test(monthParam) ? monthParam : thisMonthJst();
  const { scopeIds } = await resolveStoreScope(user, url.searchParams.get("storeId"));
  const rows = await queryAttendance(month, scopeIds);
  const body = await buildWorkbook(month, rows);
  return new NextResponse(new Uint8Array(body), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="timecard_sheet_${month}.xlsx"`,
    },
  });
}
