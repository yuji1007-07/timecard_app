import { NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * LINE Messaging API の Webhook 受け口。
 * 友だち追加・メッセージ送信に反応して、その人の「LINEユーザーID(U...)」を本人に返信する。
 * これにより、各スタッフが自分のIDを簡単に取得→管理者に伝えて登録できる。
 *
 * 設定: LINE Developers の Webhook URL に  https://<ドメイン>/api/line/webhook  を指定。
 * 必要な環境変数: LINE_CHANNEL_SECRET（署名検証）/ LINE_CHANNEL_ACCESS_TOKEN（返信送信）。
 */

type LineEvent = {
  type: string;
  replyToken?: string;
  source?: { type?: string; userId?: string };
  message?: { type?: string; text?: string };
};

async function replyText(replyToken: string, text: string, token: string) {
  await fetch("https://api.line.me/v2/bot/message/reply", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ replyToken, messages: [{ type: "text", text }] }),
  }).catch(() => {});
}

// 登録状況に応じた案内文を作る
async function buildIdMessage(userId: string): Promise<string> {
  const user = await prisma.user.findFirst({ where: { lineUserId: userId } }).catch(() => null);
  if (user) {
    return `✅ ${user.name} さんとして登録済みです。\nこれから報告のフィードバックやお知らせがここに届きます。`;
  }
  return (
    "あなたのLINEユーザーIDはこちらです👇\n\n" +
    userId +
    "\n\nこのIDをコピーして管理者に伝えてください。" +
    "\n管理画面の「ユーザー管理」であなたのアカウントに登録すると、通知が届くようになります。"
  );
}

export async function POST(req: Request) {
  const secret = process.env.LINE_CHANNEL_SECRET;
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;

  // 生のリクエストボディ（署名検証のため文字列のまま取得）
  const body = await req.text();

  // 署名検証（secret 設定時のみ。なりすまし防止）
  if (secret) {
    const signature = req.headers.get("x-line-signature") || "";
    const expected = crypto.createHmac("sha256", secret).update(body).digest("base64");
    if (signature !== expected) {
      return NextResponse.json({ ok: false, error: "署名が一致しません。" }, { status: 401 });
    }
  }

  let events: LineEvent[] = [];
  try {
    events = (JSON.parse(body)?.events ?? []) as LineEvent[];
  } catch {
    events = [];
  }

  // トークンがあれば返信する（無くてもLINE側には200を返す必要がある）
  if (token) {
    for (const ev of events) {
      const userId = ev.source?.userId;
      if (!ev.replyToken || !userId) continue;
      if (ev.type === "follow") {
        const msg = await buildIdMessage(userId);
        await replyText(ev.replyToken, "友だち追加ありがとうございます！\n\n" + msg, token);
      } else if (ev.type === "message" && ev.message?.type === "text") {
        const msg = await buildIdMessage(userId);
        await replyText(ev.replyToken, msg, token);
      }
    }
  }

  // LINEには常に200を返す（200以外だとLINE側で再送・エラー表示になる）
  return NextResponse.json({ ok: true });
}

// LINEコンソールの「検証」ボタンはGET/HEADで疎通確認することがあるため200を返す
export async function GET() {
  return NextResponse.json({ ok: true, message: "LINE webhook is alive." });
}
