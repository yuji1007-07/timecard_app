import OpenAI from "openai";
import { getSetting } from "@/lib/settings";
import type { ParsedPdfTable } from "@/lib/pdf-table";

/**
 * スプレッドシートのスクリーンショット／写真から表を読み取る。
 *
 * PDF出力ができない場面（スマホでシートを撮る・画面をスクショする）向け。
 * 画像はレイアウト解析では歯が立たないので、視覚対応モデルに「表をJSONで書き出す」よう依頼し、
 * PDF解析（parsePdfTable）と同じ ParsedTable 形（columns / rows）に揃えて返す。
 */

const SYSTEM_PROMPT = `あなたは日本の整骨院・鍼灸・エステ店の業績管理シートを読み取るOCRエンジンです。
画像に写っている表を、そのままJSONに書き起こしてください。数値の意味を解釈したり補完したりしてはいけません。

出力は次の形のJSONのみ（説明文やマークダウンの囲みは付けない）:
{
  "columns": [{"index":0,"header":"7月"},{"index":1,"header":"~7日"}],
  "rows": [{"section":"定額会員","label":"入会数","cells":{"0":12,"1":3}}]
}

ルール:
- columns は表の数値列だけを左から順に。項目名の列は含めない。header は列見出しの文字（例: "7月", "~7日", "月末", "8月予算", "9月着地"）。
- rows の label は行の項目名。小見出し（「定額会員」「新定額会員」「プレミアム会員」など）の下にある行は section にその見出し名を入れる。小見出し自体は行にしない。
- cells のキーは列のindexを文字列にしたもの。値は数値のみ（カンマ・円・%・人などの単位は取り除く）。空欄や「-」は入れない。
- 負の数は - を付ける。小数はそのまま。パーセントは数値だけ（50% → 50）。
- 読み取れない値は入れない（推測しない）。
- 画像が複数ある場合は、同じ表の続きとして1つのJSONにまとめる。`;

export function isImageParseConfigured(): boolean {
  return !!process.env.OPENAI_API_KEY;
}

type RawTable = {
  columns?: { index?: number; header?: string }[];
  rows?: { section?: string | null; label?: string; cells?: Record<string, unknown> }[];
};

const toNum = (v: unknown): number | null => {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v !== "string") return null;
  const s = v.replace(/[,\s円%人回日枚]/g, "").replace(/[^\d.-]/g, "");
  if (!s || s === "-" || s === ".") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
};

/** 画像（1枚以上）から表を読み取る。APIキー未設定時は理由付きで失敗を返す。 */
export async function parseImageTable(
  images: { buffer: Buffer; mime: string }[]
): Promise<{ ok: true; table: ParsedPdfTable } | { ok: false; error: string }> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return {
      ok: false,
      error:
        "画像の読み取りにはAIの設定が必要です。管理者に OPENAI_API_KEY の設定を依頼するか、スプレッドシートからPDFで出力したファイルをお使いください。",
    };
  }
  // 視覚対応モデルを使う（設定のモデルが未対応だと読めないため既定を優先）
  const model = (await getSetting("openaiVisionModel")) || process.env.OPENAI_VISION_MODEL || "gpt-4o";

  try {
    const client = new OpenAI({ apiKey });
    const completion = await client.chat.completions.create({
      model,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            { type: "text" as const, text: "この画像の表をJSONに書き起こしてください。" },
            ...images.map((im) => ({
              type: "image_url" as const,
              image_url: { url: `data:${im.mime};base64,${im.buffer.toString("base64")}`, detail: "high" as const },
            })),
          ],
        },
      ],
    });

    const text = completion.choices[0]?.message?.content?.trim() ?? "";
    if (!text) return { ok: false, error: "画像から表を読み取れませんでした。" };

    let raw: RawTable;
    try {
      raw = JSON.parse(text) as RawTable;
    } catch {
      return { ok: false, error: "画像の読み取り結果を解釈できませんでした。もう一度お試しください。" };
    }

    const columns = (raw.columns ?? [])
      .map((c, i) => ({ index: typeof c.index === "number" ? c.index : i, header: String(c.header ?? "").trim(), samples: [] as string[] }))
      .filter((c) => Number.isFinite(c.index));

    const rows = (raw.rows ?? [])
      .map((r) => {
        const cells: Record<string, number> = {};
        for (const [k, v] of Object.entries(r.cells ?? {})) {
          const n = toNum(v);
          if (n != null) cells[String(k)] = n;
        }
        return { section: r.section ? String(r.section) : null, label: String(r.label ?? "").trim(), cells };
      })
      .filter((r) => r.label && Object.keys(r.cells).length > 0);

    if (rows.length === 0) {
      return { ok: false, error: "画像から数値を読み取れませんでした。表全体が写っている、明るく鮮明な画像でお試しください。" };
    }

    // プレビュー用のサンプル値を列ごとに詰める
    for (const c of columns) {
      c.samples = rows
        .map((r) => r.cells[String(c.index)])
        .filter((v): v is number => v != null)
        .slice(0, 3)
        .map((v) => v.toLocaleString());
    }

    return { ok: true, table: { columns, rows } };
  } catch (e) {
    return { ok: false, error: `画像の読み取りに失敗しました: ${(e as Error).message}` };
  }
}
