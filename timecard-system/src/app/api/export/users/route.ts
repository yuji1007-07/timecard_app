import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, requireAdmin } from "@/lib/session";
import { todayJst } from "@/lib/time";

export const dynamic = "force-dynamic";

/** スタッフ一覧CSV（全体管理者のみ）。パスワードは含まない */
export async function GET(req: Request) {
  if (!(await getSessionUser())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  await requireAdmin();
  const url = new URL(req.url);
  const brand = url.searchParams.get("brand") || "";
  const storeId = url.searchParams.get("storeId") || "";

  const users = await prisma.user.findMany({
    include: { store: true, permissions: { include: { store: true } } },
    orderBy: [{ store: { brand: "asc" } }, { store: { name: "asc" } }, { name: "asc" }],
  });
  const rows = users.filter((u) => (storeId ? u.storeId === storeId : brand ? u.store?.brand === brand : true));

  const header = ["氏名", "ユーザーID", "権限", "ブランド", "主所属店舗", "担当店舗", "状態", "登録日"];
  const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const lines = [header.join(",")];
  for (const u of rows) {
    const isManager = u.role === "ADMIN" || u.permissions.length > 0;
    lines.push(
      [
        u.name,
        u.loginId,
        u.role === "ADMIN" ? "全体管理者" : isManager ? "店舗責任者" : "一般スタッフ",
        u.store?.brand ?? "",
        u.store?.name ?? "",
        u.permissions.map((p) => p.store.name).join(" / "),
        u.isActive ? "有効" : "無効",
        u.createdAt.toISOString().slice(0, 10),
      ]
        .map(esc)
        .join(",")
    );
  }
  const body = Buffer.concat([Buffer.from("﻿", "utf8"), Buffer.from(lines.join("\r\n"), "utf8")]);
  return new NextResponse(new Uint8Array(body), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="staff_${todayJst()}.csv"`,
    },
  });
}
