import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { buildCsv, csvResponse } from "@/lib/csv";
import { POSITIONS, label } from "@/lib/constants";
import { fmtDateTime, todayJst } from "@/lib/time";

export const dynamic = "force-dynamic";

/** ふりかえり CSV。本部のみ */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!user.isAdmin) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const list = await prisma.reflection.findMany({
    include: { user: { include: { store: true } }, video: { select: { title: true } } },
    orderBy: { updatedAt: "asc" },
  });
  const rows = list.map((r) => [
    fmtDateTime(r.updatedAt),
    r.user.store?.brand ?? "",
    r.user.store?.name ?? "",
    r.user.name,
    r.user.loginId,
    label(POSITIONS, r.user.position),
    r.video.title,
    r.selfRating,
    r.action,
  ]);
  const header = ["記入日時", "ブランド", "店舗", "氏名", "ユーザーID", "役職", "動画", "自己評価(1-5)", "明日からやること"];
  return csvResponse(`training_reflections_${todayJst()}.csv`, buildCsv(header, rows));
}
