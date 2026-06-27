import { NextRequest, NextResponse } from "next/server";

/**
 * LINE Webhook。友だち追加/メッセージ時に、送信者のユーザーIDを返信する。
 * （本部のLINE IDを調べてユーザー管理に登録するため。週次報告システムと同じ流儀）
 * 署名検証は簡易。トークン未設定でも 200 を返してアプリは動作する。
 */
export async function POST(req: NextRequest) {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  let body: { events?: { type: string; replyToken?: string; source?: { userId?: string } }[] } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: true });
  }
  if (!token) return NextResponse.json({ ok: true });

  for (const ev of body.events ?? []) {
    const userId = ev.source?.userId;
    if (ev.replyToken && userId) {
      await fetch("https://api.line.me/v2/bot/message/reply", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          replyToken: ev.replyToken,
          messages: [{ type: "text", text: `あなたのLINEユーザーID:\n${userId}\n\nこのIDを本部ユーザーに登録すると在庫通知が届きます。` }],
        }),
      }).catch(() => {});
    }
  }
  return NextResponse.json({ ok: true });
}

export async function GET() {
  return NextResponse.json({ ok: true });
}
