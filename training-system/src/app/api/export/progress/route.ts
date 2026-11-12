import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { getProgressMatrix } from "@/lib/progress";
import { buildCsv, csvResponse } from "@/lib/csv";
import { CATEGORIES, POSITIONS, label } from "@/lib/constants";
import { STATUS_LABELS } from "@/lib/videos";
import { todayJst } from "@/lib/time";

export const dynamic = "force-dynamic";

/** 進捗表 CSV（1行 = スタッフ×対象動画）。本部は全店舗、店長は自店舗のみ */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!user.isAdmin && !user.isStoreManager) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const m = await getProgressMatrix(user.isAdmin ? {} : { storeId: user.storeId! });

  const rows: unknown[][] = [];
  for (const u of m.users) {
    for (const v of m.videos) {
      const c = m.cells[u.id][v.id];
      if (!c.target) continue;
      rows.push([
        u.brand,
        u.storeName,
        u.name,
        u.loginId,
        label(POSITIONS, u.position),
        v.title,
        label(CATEGORIES, v.category),
        c.required ? "必修" : "",
        v.dueDate ?? "",
        STATUS_LABELS[c.status],
        c.percent,
        c.completedOn ?? "",
        c.lastViewedOn ?? "",
        c.viewCount,
        c.bestScore ?? "",
        c.attempts,
      ]);
    }
  }
  const header = ["ブランド", "店舗", "氏名", "ユーザーID", "役職", "動画", "カテゴリ", "必修", "期限", "状態", "視聴%", "初回完了日", "最終視聴日", "視聴回数", "テスト最高点(%)", "受験回数"];
  return csvResponse(`training_progress_${todayJst()}.csv`, buildCsv(header, rows));
}
