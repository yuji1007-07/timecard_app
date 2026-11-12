import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { isVideoVisibleTo } from "@/lib/videos";
import { mergeSegments, sanitizeSegments, totalSeconds, type Segment } from "@/lib/segments";
import { WATCH_COMPLETE_RATIO } from "@/lib/constants";

export const dynamic = "force-dynamic";

/**
 * 視聴記録の自動保存（再生中に数秒ごと、プレーヤーから呼ばれる）。
 * サーバーアクションではなく API ルートにしているのは、画面の再描画を起こさず
 * 裏で静かに保存するため（CLAUDE.md 4章: revalidatePath を使わない）。
 *
 * body: { videoId, start?: true, segments?: [[開始秒, 終了秒], ...], position?: 秒 }
 *  - 記録するのは必ず「ログイン中の本人」の分だけ
 *  - 前回の保存からの経過時間より明らかに多い再生量は受け付けない（早送り・不正対策。2倍速まで許容）
 */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "ログインし直してください。" }, { status: 401 });

  let body: { videoId?: unknown; start?: unknown; segments?: unknown; position?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "不正なリクエストです。" }, { status: 400 });
  }
  const videoId = typeof body.videoId === "string" ? body.videoId : "";
  const video = videoId ? await prisma.video.findUnique({ where: { id: videoId } }) : null;
  if (!video) return NextResponse.json({ error: "動画が見つかりません。" }, { status: 404 });
  if (!isVideoVisibleTo(video, { role: user.role, position: user.position, brand: user.storeBrand })) {
    return NextResponse.json({ error: "この動画は対象外です。" }, { status: 403 });
  }
  const duration = video.durationSec;
  if (duration <= 0 || !video.youtubeUrl) return NextResponse.json({ error: "この動画は準備中です。" }, { status: 400 });

  const now = new Date();
  const current = await prisma.viewProgress.findUnique({ where: { userId_videoId: { userId: user.id, videoId } } });

  // 再生開始の合図: 視聴回数 +1、経過時間の基準をリセット
  if (body.start === true) {
    const saved = await prisma.viewProgress.upsert({
      where: { userId_videoId: { userId: user.id, videoId } },
      create: { userId: user.id, videoId, viewCount: 1, lastViewedAt: now, lastSavedAt: now },
      update: { viewCount: { increment: 1 }, lastViewedAt: now, lastSavedAt: now },
    });
    return NextResponse.json({ ok: true, percent: saved.percent, completed: !!saved.completedAt });
  }

  const before = mergeSegments(sanitizeSegments(current?.segments, duration));
  const incoming = sanitizeSegments(body.segments, duration);
  let merged: Segment[] = mergeSegments([...before, ...incoming]);
  const added = totalSeconds(merged) - totalSeconds(before);

  // 経過時間チェック: 前回保存からの実時間 × 2倍速 + 余裕 を超える分は記録しない
  const elapsedSec = current?.lastSavedAt ? (now.getTime() - current.lastSavedAt.getTime()) / 1000 : 0;
  const allowed = elapsedSec * 2.1 + 5;
  const rejected = added > allowed;
  if (rejected) merged = before;

  const watchedSec = totalSeconds(merged);
  const completedNow = watchedSec >= duration * WATCH_COMPLETE_RATIO;
  const percent = completedNow && watchedSec >= duration - 1 ? 100 : Math.min(100, Math.floor((watchedSec / duration) * 100));
  const pos = Number(body.position);
  const lastPosition = Number.isFinite(pos) ? Math.max(0, Math.min(duration, pos)) : (current?.lastPosition ?? 0);
  const completedAt = current?.completedAt ?? (completedNow ? now : null);

  const data = {
    segments: merged,
    watchedSec,
    percent,
    lastPosition,
    lastViewedAt: now,
    completedAt,
    ...(rejected ? {} : { lastSavedAt: now }),
  };
  await prisma.viewProgress.upsert({
    where: { userId_videoId: { userId: user.id, videoId } },
    create: { userId: user.id, videoId, viewCount: 1, ...data, lastSavedAt: now },
    update: data,
  });

  return NextResponse.json({ ok: true, percent, completed: !!completedAt, justCompleted: !current?.completedAt && !!completedAt });
}
