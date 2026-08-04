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
  "columns": [{"index":0,"header":"7月予算"},{"index":1,"header":"7月実績"},{"index":2,"header":"差異"},{"index":3,"header":"8月"}],
  "rows": [{"section":"新定額会員","label":"入会数","cells":{"0":12,"1":3}}]
}

列（columns）の作り方 — ここが最重要:
- 数値が入っている列だけを、左から順に index 0,1,2… と付ける。項目名（一番左の見出し列）は含めない。
- header は「その列の一番上に書かれている見出し」を、**その列の真上のものだけ**を拾う。
  隣の列の見出しを混ぜない。見出しが2段（例: 上段「8月」下段「予算」）なら "8月予算" のように連結する。
- 月次シートでよくある並びは 〔先月の予算〕〔先月の実績〕〔差異〕〔翌月〕〔翌々月〕〔3ヶ月後〕。
  「差異」「差分」の列も必ず1列として出力すること（数が合わなくなるため飛ばさない）。
- 見出しが空欄の列は header を "" にしてよいが、列自体は必ず出力する。
- 列の数と、各行の数値の個数が一致しているか必ず確認してから出力する。

行（rows）の作り方:
- label は行の項目名。小見出し（「新定額会員」「プレミアム会員」「ダイエットコース」など）の下にある行は section にその見出し名を入れる。小見出し自体は行にしない。
- cells のキーは列のindexを文字列にしたもの。値は数値のみ（カンマ・円・%・人などの単位は取り除く）。
- 空欄や「-」はキーごと入れない。値のズレを防ぐため、空欄の列を詰めてはいけない。
- 負の数は - を付ける。小数はそのまま。パーセントは数値だけ（50% → 50）。
- 読み取れない値は入れない（推測・計算をしない）。
- 画像が複数ある場合は、同じ表の続きとして1つのJSONにまとめる（列の並びは共通）。`;

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
