import OpenAI from "openai";
import { getSetting } from "@/lib/settings";
import type { ParsedPdfTable } from "@/lib/pdf-table";

/**
 * スプレッドシートのスクリーンショット／写真から表を読み取る。
 *
 * PDF出力ができない場面（スマホでシートを撮る・画面をスクショする）向け。
 * 画像はレイアウト解析では歯が立たないので、視覚対応モデルに「表をJSONで書き出す」よう依頼し、
 * PDF解析（parsePdfTable）と同じ ParsedTable 形（columns / rows）に揃えて返す。
 *
 * 読み違いを減らすための工夫:
 * - モデルは画像を内部で縮小してから読むため、大きな表を1枚で渡すと小さな数字が潰れる。
 *   ブラウザ側で「全体（列の位置の把握用）」と「上から帯状に切った拡大画像（数字を読む用）」を作って一緒に渡す。
 * - 列番号つきの {"0":12} 形式だと空欄の扱いで列がずれやすい。各行を「全列ぶんの配列（空欄は null）」で
 *   書かせ、JSONスキーマで形を固定する。
 */

const SYSTEM_PROMPT = `あなたは日本の整骨院・鍼灸・エステ店の業績管理シートを読み取るOCRエンジンです。
画像に写っている表を、そのままJSONに書き起こしてください。数値の意味を解釈したり、計算・補完したりしてはいけません。

画像について:
- 「全体」の画像は表全体です。列の並び・見出し・行の順番はこれで把握してください。
- 「拡大」の画像は同じ表を上から順に帯状に切って拡大したものです（隣どうしは少し重なっています）。
  数字は必ず拡大画像で1文字ずつ確認して読み取ってください。重なり部分の行を二重に出力しないこと。
- 画像が複数ある場合は、同じ表の続きとして1つにまとめてください（列の並びは共通）。

columns（数値が入る列）:
- 項目名の列（一番左の見出し列）を除き、数値が入る列を左から順にすべて並べる。
- header はその列の真上にある見出し。見出しが2段（上段「8月」下段「予算」）なら "8月予算" のように連結する。
  隣の列の見出しを混ぜないこと。見出しが空欄の列も header を "" にして必ず含める。
- 「差異」「差分」の列も1列として必ず含める（飛ばすと右側の列がずれるため）。

rows（行）:
- label はその行の項目名を書かれている通りに（（決済あり）（P）のような注記も含めて）写す。注釈番号 [1] は不要。
- section は、その行が属する小見出し（【会員】【骨盤】【カルテ枚数】など）の名前を【】を外して入れる。小見出しが無ければ null。
- 小見出しの行そのものに数値が入っている場合は、その行も label を小見出し名にして出力する。数値の無い小見出し行は出力しない。
- values は columns と同じ数・同じ順番の配列にする。空欄・「-」・読めない値は null を入れて位置を保つ（詰めない）。
- 数値はカンマ・円・¥・%・人などの記号を除いた数にする（50% → 50、¥1,234 → 1234、-3 → -3）。小数はそのまま。
- 数値が1つも無い行は出力しない。行は表の上から下の順番で出力する。`;

// 出力の形を固定する（Structured Outputs）。使えないモデルでは json_object で同じ形を頼む
const TABLE_SCHEMA = {
  name: "sheet_table",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["columns", "rows"],
    properties: {
      columns: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["header"],
          properties: { header: { type: "string" } },
        },
      },
      rows: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["section", "label", "values"],
          properties: {
            section: { type: ["string", "null"] },
            label: { type: "string" },
            values: { type: "array", items: { type: ["number", "null"] } },
          },
        },
      },
    },
  },
} as const;

export function isImageParseConfigured(): boolean {
  return !!process.env.OPENAI_API_KEY;
}

export type SheetImage = {
  buffer: Buffer;
  mime: string;
  /** ブラウザで切り出した拡大画像（上から順）。無ければ全体画像だけで読む */
  strips?: { buffer: Buffer; mime: string }[];
};

type RawTable = {
  columns?: { index?: number; header?: string }[];
  rows?: {
    section?: string | null;
    label?: string;
    values?: unknown[];
    cells?: Record<string, unknown>; // 旧形式（json_object で返ってきた場合の保険）
  }[];
};

const toNum = (v: unknown): number | null => {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v !== "string") return null;
  const s = v.replace(/[,\s円%人回日枚]/g, "").replace(/−/g, "-").replace(/[^\d.-]/g, "");
  if (!s || s === "-" || s === ".") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
};

// gpt-5 / o系 は temperature を受け付けず、出力上限の指定名も違う
const isReasoningModel = (m: string) => /^(gpt-5|o\d)/.test(m);

/** 画像（1枚以上）から表を読み取る。APIキー未設定時は理由付きで失敗を返す。 */
export async function parseImageTable(
  images: SheetImage[]
): Promise<{ ok: true; table: ParsedPdfTable } | { ok: false; error: string }> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return {
      ok: false,
      error:
        "画像の読み取りにはAIの設定が必要です。管理者に OPENAI_API_KEY の設定を依頼するか、スプレッドシートからPDFで出力したファイルをお使いください。",
    };
  }
  if (images.some((im) => /hei[cf]/i.test(im.mime))) {
    return {
      ok: false,
      error: "HEIC形式の写真は読み取れません。スクリーンショット（PNG/JPEG）を撮り直すか、PDFで出力したファイルをお使いください。",
    };
  }

  // 設定のモデル → 環境変数 → 既定。使えないモデル（アカウントで未提供など）は次の候補で読み直す
  const configured = ((await getSetting("openaiVisionModel")) || process.env.OPENAI_VISION_MODEL || "").trim();
  const models = [...new Set([configured, "gpt-4.1", "gpt-4o"].filter(Boolean))];

  const dataUrl = (im: { buffer: Buffer; mime: string }) => `data:${im.mime};base64,${im.buffer.toString("base64")}`;
  const content: OpenAI.Chat.Completions.ChatCompletionContentPart[] = [
    { type: "text", text: "この画像の表をJSONに書き起こしてください。" },
  ];
  images.forEach((im, i) => {
    const tag = images.length > 1 ? `画像${i + 1}` : "画像";
    content.push({ type: "text", text: `【${tag}：全体】` });
    content.push({ type: "image_url", image_url: { url: dataUrl(im), detail: "high" } });
    if (im.strips?.length) {
      content.push({ type: "text", text: `【${tag}：拡大】上から順に${im.strips.length}枚（隣どうしは少し重なっています）` });
      for (const s of im.strips) content.push({ type: "image_url", image_url: { url: dataUrl(s), detail: "high" } });
    }
  });

  const client = new OpenAI({ apiKey });
  const call = (model: string, schema: boolean) =>
    client.chat.completions.create({
      model,
      ...(isReasoningModel(model)
        ? { reasoning_effort: "low" as const, max_completion_tokens: 16000 }
        : { temperature: 0, max_tokens: 12000 }),
      response_format: schema ? { type: "json_schema", json_schema: TABLE_SCHEMA } : { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content },
      ],
    });

  let text = "";
  let truncated = false;
  let lastError: unknown = null;
  outer: for (const model of models) {
    for (const schema of [true, false]) {
      try {
        const completion = await call(model, schema);
        text = completion.choices[0]?.message?.content?.trim() ?? "";
        truncated = completion.choices[0]?.finish_reason === "length";
        break outer;
      } catch (e) {
        lastError = e;
        const status = (e as { status?: number }).status;
        // モデル未提供・出力形式に未対応（400/403/404）だけ次の候補で読み直す。
        // キー誤り・利用上限・障害は他のモデルでも同じで、時間切れになるだけなので打ち切る
        if (status !== 400 && status !== 403 && status !== 404) break outer;
        // モデル自体が無い・使えないなら出力形式を変えても同じなので、すぐ次のモデルへ
        if (status !== 400) continue outer;
      }
    }
  }
  if (!text) {
    if (lastError) return { ok: false, error: `画像の読み取りに失敗しました: ${(lastError as Error).message}` };
    return { ok: false, error: "画像から表を読み取れませんでした。" };
  }

  let raw: RawTable;
  try {
    raw = JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g, "")) as RawTable;
  } catch {
    return {
      ok: false,
      error: truncated
        ? "表が大きすぎて読み取りきれませんでした。表を上下2枚に分けて撮影し、まとめて選んでください。"
        : "画像の読み取り結果を解釈できませんでした。もう一度お試しください。",
    };
  }

  const columns = (raw.columns ?? []).map((c, i) => ({ index: i, header: String(c.header ?? "").trim(), samples: [] as string[] }));

  const rows: ParsedPdfTable["rows"] = [];
  for (const r of raw.rows ?? []) {
    const cells: Record<string, number> = {};
    if (Array.isArray(r.values)) {
      r.values.forEach((v, i) => {
        const n = toNum(v);
        if (n != null) cells[String(i)] = n;
      });
    } else {
      for (const [k, v] of Object.entries(r.cells ?? {})) {
        const n = toNum(v);
        if (n != null) cells[String(k)] = n;
      }
    }
    const label = String(r.label ?? "").trim().replace(/^【(.+)】$/, "$1");
    const section = r.section ? String(r.section).trim().replace(/^【(.+)】$/, "$1") || null : null;
    if (!label || Object.keys(cells).length === 0) continue;
    // 拡大画像の重なり部分を二重に書き出した行（直前と全く同じ行）は捨てる
    const prev = rows[rows.length - 1];
    if (prev && prev.label === label && prev.section === section && JSON.stringify(prev.cells) === JSON.stringify(cells)) continue;
    rows.push({ section, label, cells });
  }

  if (rows.length === 0) {
    return { ok: false, error: "画像から数値を読み取れませんでした。表全体が写っている、明るく鮮明な画像でお試しください。" };
  }

  // 見出しより値の方が右に多い場合（見出しの読み落とし）も、列として扱えるよう補う
  const maxCol = Math.max(-1, ...rows.flatMap((r) => Object.keys(r.cells).map(Number)));
  for (let i = columns.length; i <= maxCol; i++) columns.push({ index: i, header: "", samples: [] });

  // プレビュー用のサンプル値を列ごとに詰める
  for (const c of columns) {
    c.samples = rows
      .map((r) => r.cells[String(c.index)])
      .filter((v): v is number => v != null)
      .slice(0, 3)
      .map((v) => v.toLocaleString());
  }

  return { ok: true, table: { columns, rows } };
}
