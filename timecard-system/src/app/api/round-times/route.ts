import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { calcWorkMinutes, roundToNearest5 } from "@/lib/time";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * 既存の打刻時刻を5分単位で四捨五入する（1回限りのメンテナンス用）。
 * 使い方: /api/round-times?key=<AUTH_SECRET>&from=2026-11-01
 * from 以降の勤務日が対象。出勤・休憩開始・休憩終了・退勤を丸め、休憩分（開始・終了がある場合）と実働を再計算する。
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const key = (url.searchParams.get("key") || "").replace(/ /g, "+").trim();
  const expected = (process.env.AUTH_SECRET || "").trim().replace(/^['"`]+/, "").replace(/['"`]+$/, "");
  if (!expected || key !== expected) return NextResponse.json({ ok: false, error: "認証エラー" }, { status: 401 });
  const from = url.searchParams.get("from") || "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from)) return NextResponse.json({ ok: false, error: "from=YYYY-MM-DD を指定してください。" }, { status: 400 });

  const rows = await prisma.attendance.findMany({ where: { workDate: { gte: from } } });
  let updated = 0;
  const r5 = (d: Date | null) => (d ? roundToNearest5(d) : null);
  for (const a of rows) {
    const clockIn = r5(a.clockIn);
    const clockOut = r5(a.clockOut);
    const breakStart = r5(a.breakStart);
    const breakEnd = r5(a.breakEnd);
    let breakMinutes = a.breakMinutes;
    if (breakStart && breakEnd && breakEnd > breakStart && a.breakStart && a.breakEnd) {
      breakMinutes = Math.floor((breakEnd.getTime() - breakStart.getTime()) / 60000);
    }
    const workMinutes = calcWorkMinutes(clockIn, clockOut, breakMinutes);
    const same =
      (clockIn?.getTime() ?? null) === (a.clockIn?.getTime() ?? null) &&
      (clockOut?.getTime() ?? null) === (a.clockOut?.getTime() ?? null) &&
      (breakStart?.getTime() ?? null) === (a.breakStart?.getTime() ?? null) &&
      (breakEnd?.getTime() ?? null) === (a.breakEnd?.getTime() ?? null) &&
      breakMinutes === a.breakMinutes &&
      workMinutes === a.workMinutes;
    if (same) continue;
    await prisma.attendance.update({ where: { id: a.id }, data: { clockIn, clockOut, breakStart, breakEnd, breakMinutes, workMinutes } });
    updated += 1;
  }
  return NextResponse.json({ ok: true, message: `${from} 以降の打刻 ${rows.length} 件のうち ${updated} 件を5分単位に丸めました。` });
}
