import { getSetting } from "@/lib/settings";

export function isLineConfigured(): boolean {
  return !!process.env.LINE_CHANNEL_ACCESS_TOKEN;
}

export type LinePushResult = { ok: boolean; message: string };

/**
 * LINE Messaging API でプッシュ通知を送る。
 * トークン未設定 or 通知OFF の場合は送信せず理由を返す（ドライラン）。
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
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
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
  unsubmitted: (deadline: string) =>
    `【未提出のお知らせ】\n週次報告が未提出です。\n本日${deadline}までに入力をお願いします。`,
  feedback: () =>
    `【フィードバック】\n週次報告のフィードバックが届いています。\n管理画面から確認してください。`,
  alert: (storeName: string, condition: string) =>
    `【要注意通知】\n${storeName} が要注意条件に該当しました。\n条件: ${condition}`,
};
