import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { getDiagnosticsExport } from "@/lib/diagnostics";
import { jstDayKey } from "@/lib/stock";

export const dynamic = "force-dynamic";

/** 診断データ（JSON）のダウンロード。本部のみ。 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "ログインが必要です。" }, { status: 401 });
  if (user.role !== "AREA_MANAGER") return NextResponse.json({ error: "本部のみ利用できます。" }, { status: 403 });

  const data = await getDiagnosticsExport();
  const filename = `zaiko-shindan-${jstDayKey(new Date()).replace(/-/g, "")}.json`;
  return new NextResponse(JSON.stringify(data), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
