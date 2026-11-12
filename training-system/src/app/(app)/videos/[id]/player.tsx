"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { setPlayerPosition } from "@/lib/player-position";

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    YT?: any;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let apiPromise: Promise<void> | null = null;

/** YouTube IFrame Player API を1回だけ読み込む */
function loadYouTubeApi(): Promise<void> {
  if (apiPromise) return apiPromise;
  apiPromise = new Promise<void>((resolve) => {
    if (window.YT?.Player) return resolve();
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      resolve();
    };
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    tag.async = true;
    document.head.appendChild(tag);
  });
  return apiPromise;
}

const PLAYING = 1;
const SAVE_INTERVAL_MS = 5000;
const TICK_MS = 500;

/**
 * 動画プレーヤー＋視聴チェック。
 *  - 再生中、0.5秒ごとに再生位置を見て「実際に再生した区間」を作る
 *    （位置が飛んだ＝シーク・早送りは区間を切るので、飛ばした部分は数えない。倍速は実時間×速度まで連続とみなす）
 *  - 5秒ごと／一時停止／画面を閉じるときに /api/progress へ保存（画面の再描画なし）
 *  - 90%に達した瞬間だけ router.refresh() してテストを解放する
 */
export function VideoPlayer({
  videoId,
  youtubeId,
  durationSec,
  startAt,
  initialPercent,
  initialCompleted,
  completePercent,
}: {
  videoId: string;
  youtubeId: string;
  durationSec: number;
  startAt: number;
  initialPercent: number;
  initialCompleted: boolean;
  completePercent: number;
}) {
  const router = useRouter();
  const holderRef = useRef<HTMLDivElement>(null);
  const startAtRef = useRef(startAt);
  const [percent, setPercent] = useState(initialPercent);
  const [completed, setCompleted] = useState(initialCompleted);
  const [saveError, setSaveError] = useState(false);

  useEffect(() => {
    let destroyed = false;
    let player: any = null;
    const pending: [number, number][] = [];
    let cur: { start: number; last: number } | null = null;
    let lastWall = performance.now();
    let started = false;
    let dirty = false;
    let lastPos = startAtRef.current;
    let queue: Promise<unknown> = Promise.resolve();

    setPlayerPosition(lastPos);

    const post = (payload: Record<string, unknown>) =>
      fetch("/api/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoId, ...payload }),
        keepalive: true,
      }).then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json() as Promise<{ percent: number; completed: boolean; justCompleted?: boolean }>;
      });

    const closeCur = () => {
      if (cur && cur.last - cur.start > 0.2) pending.push([cur.start, cur.last]);
      cur = null;
    };

    const save = () => {
      const segs = pending.splice(0);
      if (cur && cur.last - cur.start > 0.2) {
        segs.push([cur.start, cur.last]);
        cur = { start: cur.last, last: cur.last };
      }
      if (segs.length === 0 && !dirty) return;
      dirty = false;
      const position = lastPos;
      queue = queue.then(() =>
        post({ segments: segs, position })
          .then((d) => {
            if (destroyed) return;
            setSaveError(false);
            setPercent(d.percent);
            if (d.completed) setCompleted(true);
            if (d.justCompleted) router.refresh();
          })
          .catch(() => {
            // 通信に失敗した分は次回まとめて送り直す
            pending.unshift(...segs);
            dirty = true;
            if (!destroyed) setSaveError(true);
          })
      );
    };

    const tick = () => {
      if (!player?.getPlayerState) return;
      const now = performance.now();
      const dt = (now - lastWall) / 1000;
      lastWall = now;
      const state = player.getPlayerState();
      const t = Number(player.getCurrentTime?.() ?? 0);
      if (state === PLAYING) {
        const rate = Number(player.getPlaybackRate?.() ?? 1) || 1;
        if (!started) {
          started = true;
          queue = queue.then(() => post({ start: true }).catch(() => {}));
        }
        if (cur && t >= cur.last - 0.3 && t - cur.last <= dt * rate * 1.5 + 1) {
          if (t > cur.last) cur.last = t;
        } else {
          closeCur();
          cur = { start: t, last: t };
        }
        lastPos = t;
        dirty = true;
      } else {
        if (cur) {
          closeCur();
          save();
        }
        if (t > 0 && Math.abs(t - lastPos) > 0.5) {
          lastPos = t;
          dirty = true;
        }
      }
      setPlayerPosition(Math.min(lastPos, durationSec));
    };

    loadYouTubeApi().then(() => {
      if (destroyed || !holderRef.current) return;
      const mount = document.createElement("div");
      holderRef.current.appendChild(mount);
      player = new window.YT.Player(mount, {
        videoId: youtubeId,
        width: "100%",
        height: "100%",
        playerVars: { playsinline: 1, rel: 0, modestbranding: 1, start: Math.floor(startAtRef.current) },
      });
    });

    const tickTimer = window.setInterval(tick, TICK_MS);
    const saveTimer = window.setInterval(save, SAVE_INTERVAL_MS);
    const onHide = () => {
      if (document.visibilityState === "hidden") {
        tick();
        save();
      }
    };
    const onPageHide = () => {
      tick();
      save();
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onPageHide);

    return () => {
      tick();
      closeCur();
      save();
      destroyed = true;
      window.clearInterval(tickTimer);
      window.clearInterval(saveTimer);
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onPageHide);
      try {
        player?.destroy?.();
      } catch {
        /* プレーヤーの後片付けに失敗しても無視 */
      }
    };
  }, [videoId, youtubeId, durationSec, router]);

  const shown = Math.min(100, percent);
  return (
    <div>
      <div ref={holderRef} className="aspect-video w-full overflow-hidden bg-black [&_iframe]:h-full [&_iframe]:w-full" data-testid="player" />
      <div className="space-y-1.5 p-4">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium text-navy" data-testid="watch-percent">
            再生した部分 {shown}%
          </span>
          {completed ? (
            <span className="flex items-center gap-1 font-medium text-green-700">
              <CheckCircle2 className="h-4 w-4" />
              視聴完了
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">{completePercent}%以上で視聴完了</span>
          )}
        </div>
        <div className="relative h-2.5 overflow-hidden rounded-full bg-muted">
          <div className={`h-full rounded-full transition-all ${completed ? "bg-green-500" : "bg-yellow-400"}`} style={{ width: `${shown}%` }} />
          <div className="absolute inset-y-0 w-0.5 bg-navy/50" style={{ left: `${completePercent}%` }} />
        </div>
        <p className="text-xs text-muted-foreground">
          早送りで飛ばした部分は数えません（倍速再生はOK）。{Math.floor(durationSec / 60)}分{durationSec % 60}秒の動画です。途中で閉じても、次は続きから再生できます。
        </p>
        {saveError && <p className="text-xs text-destructive">視聴記録を保存できませんでした。電波の良い場所でそのまま再生を続けてください（自動で送り直します）。</p>}
      </div>
    </div>
  );
}
