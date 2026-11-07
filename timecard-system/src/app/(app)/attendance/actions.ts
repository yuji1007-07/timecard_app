"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { canAccessStore, requireManager } from "@/lib/session";
import { calcWorkMinutes, fromInputValue, toInputValue } from "@/lib/time";

const editSchema = z.object({
  id: z.string().min(1),
  clockIn: z.string().optional(),
  breakStart: z.string().optional(),
  breakEnd: z.string().optional(),
  clockOut: z.string().optional(),
  breakMinutes: z.string().optional(),
  note: z.string().optional(),
  returnTo: z.string().optional(),
});

/** 1件編集 */
export async function updateAttendance(_prev: unknown, formData: FormData) {
  const user = await requireManager();
  const parsed = editSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;

  const record = await prisma.attendance.findUnique({ where: { id: d.id } });
  if (!record) return { error: "対象データが見つかりません。" };
  if (!canAccessStore(user, record.storeId)) return { error: "担当外の店舗データは編集できません。" };

  const clockIn = fromInputValue(d.clockIn);
  const clockOut = fromInputValue(d.clockOut);
  const breakMinutes = Math.max(0, Number.parseInt(d.breakMinutes || "0", 10) || 0);
  if (clockIn && clockOut && clockOut < clockIn) return { error: "退勤は出勤より後の時刻にしてください。" };

  await prisma.attendance.update({
    where: { id: d.id },
    data: {
      clockIn,
      breakStart: fromInputValue(d.breakStart),
      breakEnd: fromInputValue(d.breakEnd),
      clockOut,
      breakMinutes,
      workMinutes: calcWorkMinutes(clockIn, clockOut, breakMinutes),
      note: d.note?.trim() || null,
    },
  });
  redirect(`/attendance?${d.returnTo || ""}&msg=${encodeURIComponent("打刻を更新しました。")}`);
}

/** 一括編集: 変更があった行だけ更新する */
export async function bulkUpdateAttendance(_prev: unknown, formData: FormData): Promise<{ ok: boolean; message: string }> {
  const user = await requireManager();
  const ids = formData.getAll("recordIds").map(String);

  const records = await prisma.attendance.findMany({ where: { id: { in: ids } } });
  let updated = 0;

  for (const r of records) {
    if (!canAccessStore(user, r.storeId)) continue;
    const g = (k: string) => String(formData.get(`${k}_${r.id}`) ?? "");

    const clockIn = fromInputValue(g("clockIn"));
    const breakStart = fromInputValue(g("breakStart"));
    const breakEnd = fromInputValue(g("breakEnd"));
    const clockOut = fromInputValue(g("clockOut"));
    const breakMinutesRaw = Number.parseInt(g("breakMinutes") || "0", 10);
    const breakMinutes = Number.isNaN(breakMinutesRaw) ? r.breakMinutes : Math.max(0, breakMinutesRaw);
    const note = g("note").trim() || null;

    const same =
      toInputValue(clockIn) === toInputValue(r.clockIn) &&
      toInputValue(breakStart) === toInputValue(r.breakStart) &&
      toInputValue(breakEnd) === toInputValue(r.breakEnd) &&
      toInputValue(clockOut) === toInputValue(r.clockOut) &&
      breakMinutes === r.breakMinutes &&
      note === (r.note ?? null);
    if (same) continue;

    await prisma.attendance.update({
      where: { id: r.id },
      data: { clockIn, breakStart, breakEnd, clockOut, breakMinutes, workMinutes: calcWorkMinutes(clockIn, clockOut, breakMinutes), note },
    });
    updated += 1;
  }

  return { ok: true, message: updated > 0 ? `${updated} 件の打刻をまとめて更新しました。` : "変更された行はありませんでした。" };
}

/** 打刻レコード削除（全体管理者のみ） */
export async function deleteAttendance(formData: FormData) {
  const user = await requireManager();
  if (!user.isAdmin) return;
  const id = String(formData.get("id"));
  const returnTo = String(formData.get("returnTo") || "");
  await prisma.attendance.delete({ where: { id } }).catch(() => {});
  redirect(`/attendance?${returnTo}&msg=${encodeURIComponent("打刻を削除しました。")}`);
}
