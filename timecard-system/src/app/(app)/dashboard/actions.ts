"use server";

import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { calcWorkMinutes, nowMinute, todayJst } from "@/lib/time";

type PunchAction = "clock_in" | "break_start" | "break_end" | "clock_out";
export type PunchResult = { ok: boolean; message: string } | null;

/** 打刻ボタン（フォーム送信）用の入口。結果メッセージを返し、画面はクライアント側の router.refresh() で更新する */
export async function punchForm(formData: FormData): Promise<PunchResult> {
  const action = String(formData.get("action") ?? "") as PunchAction;
  if (!["clock_in", "break_start", "break_end", "clock_out"].includes(action)) return { ok: false, message: "不正な操作です。" };
  return punch(action);
}

export async function punch(action: PunchAction): Promise<PunchResult> {
  const user = await requireUser();
  if (!user.storeId) return { ok: false, message: "所属店舗が設定されていません。管理者に連絡してください。" };

  const today = todayJst();
  const now = nowMinute();
  const record = await prisma.attendance.findUnique({ where: { userId_workDate: { userId: user.id, workDate: today } } });

  if (action === "clock_in") {
    if (record?.clockIn) return { ok: false, message: "本日の出勤打刻は完了しています。" };
    if (record) {
      await prisma.attendance.update({ where: { id: record.id }, data: { clockIn: now } });
    } else {
      await prisma.attendance.create({ data: { userId: user.id, storeId: user.storeId, workDate: today, clockIn: now } });
    }
    return { ok: true, message: "出勤打刻しました。" };
  }

  if (!record || !record.clockIn) return { ok: false, message: "先に出勤打刻をしてください。" };

  if (action === "break_start") {
    if (record.breakStart && !record.breakEnd) return { ok: false, message: "すでに休憩中です。" };
    if (record.clockOut) return { ok: false, message: "退勤済みのため休憩を開始できません。" };
    await prisma.attendance.update({ where: { id: record.id }, data: { breakStart: now, breakEnd: null } });
    return { ok: true, message: "休憩開始を記録しました。" };
  }

  if (action === "break_end") {
    if (!record.breakStart) return { ok: false, message: "休憩開始が未打刻です。" };
    if (record.breakEnd) return { ok: false, message: "休憩終了はすでに記録済みです。" };
    const delta = Math.max(0, Math.floor((now.getTime() - record.breakStart.getTime()) / 60000));
    const total = (record.breakMinutes || 0) + delta;
    await prisma.attendance.update({
      where: { id: record.id },
      data: { breakEnd: now, breakMinutes: total, workMinutes: record.clockOut ? calcWorkMinutes(record.clockIn, record.clockOut, total) : null },
    });
    return { ok: true, message: "休憩終了を記録しました。" };
  }

  if (action === "clock_out") {
    if (record.clockOut) return { ok: false, message: "本日の退勤打刻は完了しています。" };
    let breakMinutes = record.breakMinutes || 0;
    const data: { clockOut: Date; workMinutes: number | null; breakEnd?: Date; breakMinutes?: number } = { clockOut: now, workMinutes: null };
    // 休憩中のまま退勤した場合は休憩を自動終了
    if (record.breakStart && !record.breakEnd) {
      const delta = Math.max(0, Math.floor((now.getTime() - record.breakStart.getTime()) / 60000));
      breakMinutes += delta;
      data.breakEnd = now;
      data.breakMinutes = breakMinutes;
    }
    data.workMinutes = calcWorkMinutes(record.clockIn, now, breakMinutes);
    await prisma.attendance.update({ where: { id: record.id }, data });
    return { ok: true, message: "退勤打刻しました。お疲れさまでした。" };
  }

  return { ok: false, message: "不正な操作です。" };
}
