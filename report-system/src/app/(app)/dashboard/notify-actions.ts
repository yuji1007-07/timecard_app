"use server";

import { prisma } from "@/lib/prisma";
import { requireAreaManager } from "@/lib/session";
import { getReportUnits } from "@/lib/units";
import { getSubmissionStatus } from "@/lib/dashboard";
import { pushLineMessage, LINE_TEMPLATES } from "@/lib/integrations/line";
import { getSetting } from "@/lib/settings";

/** 未提出の報告単位の責任者へLINE未提出通知を送る。未設定時はドライランの集計を返す。 */
export async function notifyUnsubmitted(week: string): Promise<{ message: string }> {
  await requireAreaManager();
  const units = await getReportUnits();
  const submission = await getSubmissionStatus(week, units);
  const unsubmitted = submission.filter((s) => !s.submitted);
  const deadline = (await getSetting("weeklyDeadlineTime")) || "18:00";

  if (unsubmitted.length === 0) return { message: "未提出の店舗はありません。" };

  let sent = 0;
  let skipped = 0;
  const targets: string[] = [];
  for (const s of unsubmitted) {
    targets.push(s.unit.label);
    const recipients = await prisma.user.findMany({
      where: s.unit.departmentId
        ? { departmentId: s.unit.departmentId }
        : { storeId: s.unit.storeId, role: "STORE_MANAGER" },
    });
    for (const r of recipients) {
      if (r.lineUserId) {
        const res = await pushLineMessage(r.lineUserId, LINE_TEMPLATES.unsubmitted(deadline));
        if (res.ok) sent++;
        else skipped++;
      } else {
        skipped++;
      }
    }
  }

  const base = `未提出 ${unsubmitted.length}単位（${targets.join("、")}）`;
  if (sent > 0) return { message: `${base} に通知を送信しました（送信${sent}件 / スキップ${skipped}件）。` };
  return { message: `${base}。LINE未設定のため実送信はスキップしました（対象${skipped}件）。設定画面でLINEを有効化すると送信されます。` };
}
