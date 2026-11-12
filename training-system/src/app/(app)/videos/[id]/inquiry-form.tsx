"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { getPlayerPosition } from "@/lib/player-position";
import { fmtDuration } from "@/lib/time";
import { postInquiry } from "./actions";

export function InquiryForm({ videoId }: { videoId: string }) {
  const [state, action, pending] = useActionState(postInquiry, null);
  const [position, setPosition] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();

  // プレーヤーの再生位置を1秒ごとに映す（投稿時にこの位置が付く）
  useEffect(() => {
    const read = () => setPosition(Math.floor(getPlayerPosition()));
    read();
    const timer = window.setInterval(read, 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (state?.success) {
      formRef.current?.reset();
      router.refresh();
    }
  }, [state, router]);

  return (
    <form ref={formRef} action={action} className="space-y-3">
      <input type="hidden" name="videoId" value={videoId} />
      <input type="hidden" name="positionSec" value={position} />
      <Textarea name="body" rows={3} required maxLength={1000} placeholder="分からなかったこと・もっと知りたいことを書いてください" className="text-base" />
      <div className="text-sm text-muted-foreground">
        再生位置 <span className="font-semibold tabular-nums text-navy" data-testid="inquiry-position">{fmtDuration(position)}</span> を付けて送ります
      </div>
      <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5 text-sm">
        <input type="checkbox" name="showName" className="mt-0.5 h-5 w-5 shrink-0 accent-[#1e3a5f]" />
        <span>
          Q&amp;A に自分の名前を出す
          <span className="block text-xs text-muted-foreground">チェックしない場合、ほかのスタッフには「匿名」で表示されます（本部には名前が伝わります）。</span>
        </span>
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" className="h-12 px-8 text-base" disabled={pending}>
          {pending ? "送信中..." : "質問を送る"}
        </Button>
        {state?.error && <span className="text-sm text-destructive">{state.error}</span>}
        {state?.success && <span className="text-sm text-green-600">{state.message}</span>}
      </div>
    </form>
  );
}
