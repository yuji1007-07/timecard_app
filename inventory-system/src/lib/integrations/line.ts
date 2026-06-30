import { getSetting } from "@/lib/settings";

export function isLineConfigured(): boolean {
  return !!process.env.LINE_CHANNEL_ACCESS_TOKEN;
}

export type LinePushResult = { ok: boolean; message: string };

/**
 * LINE Messaging API でプッシュ通知を送る。
 * トークン未設定 or 通知OFF の場合は送信せず理由を返す（ドライラン）。
 * 週次報告システムと同じ流儀（設定を入れれば有効になる）。
 */
export async function pushLineMessage(to: string, text: string): Promise<LinePushResult> {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  const enabled = (await getSetting("lineEnabled")) === "true";

  if (!enabled) return { ok: false, message: "LINE通知が設定でOFFになっています。" };
  if (!token) return { ok: false, message: "LINE_CHANNEL_ACCESS_TOKEN が未設定です。" };
  if (!to) return { ok: false, message: "送信先 lineUserId が未設定です。" };

  try {
    const res = await fetch("https://api.line.me/v2/bot/message/push", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ to, messages: [{ type: "text", text }] }),
    });
    if (!res.ok) {
      const body = await res.text();
      return { ok: false, message: `LINE送信失敗 (${res.status}): ${body}` };
    }
    return { ok: true, message: "送信しました。" };
  } catch (e) {
    return { ok: false, message: `LINE送信エラー: ${(e as Error).message}` };
  }
}

export const LINE_TEMPLATES = {
  notStocktaken: (storeName: string, month: string) =>
    `【棚卸未実施のお知らせ】\n${storeName} が ${month} の棚卸を未実施です。\n早めの実施をお願いします。`,
  stockDiff: (storeName: string, count: number, amount: number) =>
    `【在庫ズレ通知】\n${storeName} で在庫ズレが発生しました。\nズレ件数: ${count}件 / ズレ金額: ¥${Math.round(
      amount
    ).toLocaleString("ja-JP")}`,
  lowStock: (storeName: string, count: number) =>
    `【在庫不足通知】\n${storeName} で最小在庫を下回った商品が ${count}件 あります。`,
};
