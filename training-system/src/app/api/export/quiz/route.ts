import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { buildCsv, csvResponse } from "@/lib/csv";
import { POSITIONS, label } from "@/lib/constants";
import { fmtDateTime, todayJst } from "@/lib/time";

export const dynamic = "force-dynamic";

/** テスト結果 CSV（1行 = 受験1回）。本部のみ */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!user.isAdmin) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const attempts = await prisma.quizAttempt.findMany({
    include: { user: { include: { store: true } }, video: { select: { title: true } } },
    orderBy: { createdAt: "asc" },
  });
  const rows = attempts.map((a) => [
    fmtDateTime(a.createdAt),
    a.user.store?.brand ?? "",
    a.user.store?.name ?? "",
    a.user.name,
    a.user.loginId,
    label(POSITIONS, a.user.position),
    a.video.title,
    a.correct,
    a.total,
    a.percent,
    a.passed ? "合格" : "不合格",
  ]);
  const header = ["受験日時", "ブランド", "店舗", "氏名", "ユーザーID", "役職", "動画", "正解数", "問題数", "点数(%)", "合否"];
  return csvResponse(`training_quiz_${todayJst()}.csv`, buildCsv(header, rows));
}
