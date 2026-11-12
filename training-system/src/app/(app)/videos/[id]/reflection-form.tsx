"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveReflection } from "./actions";
import { keepForm } from "@/lib/keep-form";

const RATING_LABELS = ["", "まだ難しい", "少し不安", "だいたい分かった", "分かった", "人に説明できる"];

export function ReflectionForm({ videoId, initialRating, initialAction }: { videoId: string; initialRating: number | null; initialAction: string }) {
  const [state, action, pending] = useActionState(saveReflection, null);
  const [rating, setRating] = useState(initialRating ?? 0);
  const router = useRouter();
  useEffect(() => {
    if (state?.success) router.refresh();
  }, [state, router]);

  return (
    <form onSubmit={keepForm(action)} className="space-y-4">
      <input type="hidden" name="videoId" value={videoId} />
      <input type="hidden" name="selfRating" value={rating} />
      <div className="space-y-2">
        <Label>自己評価（どのくらい理解できましたか）</Label>
        <div className="grid grid-cols-5 gap-2">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              aria-pressed={rating === n}
              aria-label={`自己評価 ${n}`}
              onClick={() => setRating(n)}
              className={`h-12 rounded-lg border text-lg font-bold transition-colors ${
                rating === n ? "border-navy bg-navy text-white" : "border-input bg-background hover:bg-muted"
              }`}
            >
              {n}
            </button>
          ))}
        </div>
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>1 {RATING_LABELS[1]}</span>
          <span className="font-medium text-navy">{rating ? `${rating}：${RATING_LABELS[rating]}` : ""}</span>
          <span>5 {RATING_LABELS[5]}</span>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="reflection-action">明日からやること（1行）</Label>
        <Input id="reflection-action" name="action" defaultValue={initialAction} maxLength={200} required placeholder="例: 毎回の施術後に、理由を添えて次回予約を取る" className="h-12 text-base" />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" className="h-12 px-8 text-base" disabled={pending || rating === 0}>
          {pending ? "保存中..." : initialRating ? "ふりかえりを更新する" : "ふりかえりを保存する"}
        </Button>
        {state?.error && <span className="text-sm text-destructive">{state.error}</span>}
        {state?.success && <span className="text-sm text-green-600">{state.message}</span>}
      </div>
    </form>
  );
}
