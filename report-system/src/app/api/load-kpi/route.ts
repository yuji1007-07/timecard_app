import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { KPI_PRESETS } from "@/lib/kpi-presets";
import { guessUnit, guessDirection } from "@/lib/kpi-guess";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * 業態別KPIテンプレートを、ユーザー提供のプリセットで一括入れ替えする。
 * 業態テンプレート（businessType単位）のみ対象。報告データ・ユーザー・店舗には触れない。
 *
 * 使い方: /api/load-kpi?key=<AUTH_SECRET>
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const key = (url.searchParams.get("key") || "").replace(/ /g, "+").trim();
  const expected = (process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || "")
    .trim()
    .replace(/^['"`]+/, "")
    .replace(/['"`]+$/, "");

  if (!expected) {
    return NextResponse.json({ ok: false, error: "AUTH_SECRET が未設定です。" }, { status: 500 });
  }
  if (key !== expected) {
    return NextResponse.json({ ok: false, error: "認証エラー: ?key= に AUTH_SECRET を指定してください。" }, { status: 401 });
  }

  try {
    const result: Record<string, number> = {};
    for (const preset of KPI_PRESETS) {
      const scope = { businessType: preset.businessType, storeId: null, departmentId: null };
      // 既存の「業態テンプレート」KPIを削除（店舗/部門上書きには触れない）。
      // 報告に参照されているKPIはFK制約で消せないので、その場合は参照のないものだけ個別に削除する。
      try {
        await prisma.kpiItem.deleteMany({ where: scope });
      } catch {
        const existing = await prisma.kpiItem.findMany({ where: scope, select: { id: true } });
        for (const k of existing) {
          try {
            await prisma.kpiItem.delete({ where: { id: k.id } });
          } catch {
            // 報告に参照されている等で削除できないものはスキップ
          }
        }
      }
      // 重複除去して投入
      const names = Array.from(new Set(preset.names.map((n) => n.trim()).filter(Boolean)));
      await prisma.kpiItem.createMany({
        data: names.map((name, i) => {
          const unit = guessUnit(name);
          return {
            name,
            unit,
            inputType: unit === "%" ? "PERCENT" : "NUMBER",
            goodDirection: guessDirection(name),
            businessType: preset.businessType,
            showDashboard: /売上|総売上|実績/.test(name),
            sortOrder: i,
          };
        }),
      });
      result[preset.businessType] = names.length;
    }

    return NextResponse.json({
      ok: true,
      message: "KPIテンプレートを業態別に入れ替えました。",
      counts: result,
      note: "単位・良化方向は名前から自動判定しています。違う項目はKPIテンプレート画面の「編集」で調整できます。",
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
