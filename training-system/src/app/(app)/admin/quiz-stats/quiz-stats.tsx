"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/stat-card";
import { FilterTabs } from "@/components/filter-tabs";

export type VideoStat = {
  id: string;
  title: string;
  attempts: number;
  average: number | null;
  testers: number;
  passers: number;
  questions: {
    id: string;
    no: number;
    text: string;
    choices: string[];
    correctIndex: number;
    counts: number[];
    total: number;
    rate: number | null;
  }[];
};

export function QuizStats({ stats }: { stats: VideoStat[] }) {
  const [videoId, setVideoId] = useState((stats.find((s) => s.attempts > 0) ?? stats[0])?.id ?? "")  // 受験がある動画を最初に表示;
  const v = stats.find((s) => s.id === videoId);
  if (stats.length === 0) return <Card className="p-8 text-center text-sm text-muted-foreground">テスト問題が登録された動画がありません。</Card>;

  return (
    <div className="space-y-4">
      <FilterTabs title="動画" value={videoId} onChange={setVideoId} options={stats.map((s) => ({ value: s.id, label: s.title, count: s.attempts }))} />
      {v && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="受験した人" value={`${v.testers}名`} />
            <StatCard label="合格した人" value={`${v.passers}名`} tone="good" />
            <StatCard label="のべ受験回数" value={`${v.attempts}回`} />
            <StatCard label="平均点" value={v.average !== null ? `${v.average}点` : "-"} />
          </div>
          <Card>
            <CardHeader>
              <CardTitle>問題別の正答率</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {v.questions.map((q) => {
                const tone = q.rate === null ? "text-muted-foreground" : q.rate < 60 ? "text-red-600" : q.rate < 80 ? "text-yellow-700" : "text-green-700";
                return (
                  <div key={q.id} className="rounded-lg border p-4" data-testid="stat-question">
                    <div className="flex items-start justify-between gap-3">
                      <div className="font-medium leading-snug">
                        <span className="mr-1.5 text-muted-foreground">Q{q.no}.</span>
                        {q.text}
                      </div>
                      <div className={`shrink-0 text-right text-2xl font-bold tabular-nums ${tone}`}>
                        {q.rate !== null ? `${q.rate}%` : "-"}
                        <div className="text-xs font-normal text-muted-foreground">正答率（{q.total}回答）</div>
                      </div>
                    </div>
                    <ul className="mt-3 space-y-1.5">
                      {q.choices.map((c, i) => {
                        const pct = q.total > 0 ? Math.round((q.counts[i] / q.total) * 100) : 0;
                        const correct = i === q.correctIndex;
                        return (
                          <li key={i} className="text-sm">
                            <div className="flex items-baseline justify-between gap-2">
                              <span className={correct ? "font-semibold text-green-800" : ""}>
                                {correct ? "◎ " : "　 "}
                                {c}
                              </span>
                              <span className="shrink-0 tabular-nums text-muted-foreground">
                                {q.counts[i]}人（{pct}%）
                              </span>
                            </div>
                            <div className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-muted">
                              <div className={`h-full rounded-full ${correct ? "bg-green-500" : "bg-red-300"}`} style={{ width: `${pct}%` }} />
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
