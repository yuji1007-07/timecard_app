import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { buildCsv, csvResponse } from "@/lib/csv";
import { NO_SERIES_LABEL, POSITIONS, label } from "@/lib/constants";
import { getFeedbackRows } from "@/lib/feedback";
import { todayJst } from "@/lib/time";

export const dynamic = "force-dynamic";

/** フィードバック CSV。本部は全員分、店長は自店舗分 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!user.isAdmin && !user.isStoreManager) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const list = await getFeedbackRows(user.isAdmin ? {} : { storeId: user.storeId! });
  const rows = list.map((r) => [r.date, r.brand, r.storeName, r.userName, label(POSITIONS, r.position), r.series || NO_SERIES_LABEL, r.videoTitle, r.impression, r.action]);
  const header = ["記入日", "ブランド", "店舗", "氏名", "役職", "シリーズ", "動画", "感想", "今後の実用法"];
  return csvResponse(`training_feedback_${todayJst()}.csv`, buildCsv(header, rows));
}
