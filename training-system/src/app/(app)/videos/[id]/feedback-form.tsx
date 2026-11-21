"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { keepForm } from "@/lib/keep-form";
import { saveFeedback } from "./actions";

/** 視聴後のフィードバック（感想と今後の実用法） */
export function FeedbackForm({
  videoId,
  submitted,
  initialImpression,
  initialAction,
}: {
  videoId: string;
  submitted: boolean;
  initialImpression: string;
  initialAction: string;
}) {
  const [state, action, pending] = useActionState(saveFeedback, null);
  const router = useRouter();
  useEffect(() => {
    if (state?.success) router.refresh();
  }, [state, router]);

  return (
    <form onSubmit={keepForm(action)} className="space-y-4">
      <input type="hidden" name="videoId" value={videoId} />
      <div className="space-y-1.5">
        <Label htmlFor="feedback-impression">感想</Label>
        <Textarea
          id="feedback-impression"
          name="impression"
          rows={4}
          required
          maxLength={1000}
          defaultValue={initialImpression}
          placeholder="印象に残ったこと、気づいたこと、分かりにくかったところなど"
          className="text-base"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="feedback-action">今後の実用法（明日からどう活かすか）</Label>
        <Textarea
          id="feedback-action"
          name="action"
          rows={4}
          required
          maxLength={1000}
          defaultValue={initialAction}
          placeholder="例: 初診の問診で、来院のきっかけを最初に必ず聞く"
          className="text-base"
        />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" className="h-12 px-8 text-base" disabled={pending}>
          {pending ? "送信中..." : submitted ? "フィードバックを更新する" : "フィードバックを提出する"}
        </Button>
        {state?.error && <span className="text-sm text-destructive">{state.error}</span>}
        {state?.success && <span className="text-sm text-green-600">{state.message}</span>}
      </div>
    </form>
  );
}
