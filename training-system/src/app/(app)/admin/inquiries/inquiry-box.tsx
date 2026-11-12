"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { FilterTabs } from "@/components/filter-tabs";
import { fmtDuration } from "@/lib/time";
import { answerInquiry } from "./actions";

export type InquiryRow = {
  id: string;
  videoId: string;
  videoTitle: string;
  positionSec: number;
  body: string;
  answer: string;
  answered: boolean;
  userName: string;
  storeName: string;
  showName: boolean;
  createdAt: string;
  answeredAt: string | null;
};

function AnswerForm({ row }: { row: InquiryRow }) {
  const [state, action, pending] = useActionState(answerInquiry, null);
  const router = useRouter();
  useEffect(() => {
    if (state?.success) router.refresh();
  }, [state, router]);
  return (
    <form action={action} className="mt-3 space-y-2">
      <input type="hidden" name="id" value={row.id} />
      <Textarea name="answer" rows={3} required defaultValue={row.answer} placeholder="回答を入力してください" className="text-base" />
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "保存中..." : row.answered ? "回答を修正する" : "回答する"}
        </Button>
        {state?.error && <span className="text-sm text-destructive">{state.error}</span>}
        {state?.success && <span className="text-sm text-green-600">{state.message}</span>}
      </div>
    </form>
  );
}

export function InquiryBox({ rows }: { rows: InquiryRow[] }) {
  const [tab, setTab] = useState("open");
  const [videoId, setVideoId] = useState("");
  const videos = [...new Map(rows.map((r) => [r.videoId, r.videoTitle])).entries()];
  const shown = rows.filter((r) => (tab === "open" ? !r.answered : r.answered) && (!videoId || r.videoId === videoId));

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <FilterTabs
          title="状態"
          value={tab}
          onChange={setTab}
          options={[
            { value: "open", label: "未回答", count: rows.filter((r) => !r.answered).length },
            { value: "done", label: "回答済み", count: rows.filter((r) => r.answered).length },
          ]}
        />
        {videos.length > 1 && (
          <FilterTabs title="動画" value={videoId} onChange={setVideoId} options={[{ value: "", label: "すべて" }, ...videos.map(([id, title]) => ({ value: id, label: title }))]} />
        )}
      </div>
      {shown.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">{tab === "open" ? "未回答の質問はありません。" : "回答済みの質問はありません。"}</Card>
      ) : (
        shown.map((r) => (
          <Card key={r.id} className="p-4" data-testid="inquiry-row">
            <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <Link href={`/videos/${r.videoId}`} prefetch={false} className="font-medium text-navy underline-offset-2 hover:underline">
                {r.videoTitle}
              </Link>
              <span className="rounded bg-navy px-1.5 py-0.5 font-medium tabular-nums text-white">{fmtDuration(r.positionSec)}</span>
              <span>
                {r.userName}（{r.storeName}）
              </span>
              {!r.showName && <Badge variant="muted">Q&amp;Aでは匿名</Badge>}
              <span>{r.createdAt}</span>
            </div>
            <p className="whitespace-pre-wrap font-medium leading-relaxed">Q. {r.body}</p>
            {r.answeredAt && <div className="mt-2 text-xs text-muted-foreground">回答日時 {r.answeredAt}</div>}
            <AnswerForm row={r} />
          </Card>
        ))
      )}
    </div>
  );
}
