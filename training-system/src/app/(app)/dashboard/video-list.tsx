"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Clock, PlayCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FilterTabs } from "@/components/filter-tabs";
import { StatusBadge } from "@/components/status-badge";
import { CATEGORIES, label } from "@/lib/constants";
import { fmtDueDate, fmtDuration } from "@/lib/time";
import type { DueState, ProgressStatus } from "@/lib/videos";

export type VideoItem = {
  id: string;
  title: string;
  category: string;
  durationSec: number;
  thumbnail: string | null;
  ready: boolean;
  isPublished: boolean;
  required: boolean;
  dueDate: string | null;
  dueState: DueState;
  status: ProgressStatus;
  percent: number;
  bestScore: number | null;
  hasQuiz: boolean;
  done: boolean;
  priority: number;
};

export function VideoList({ items }: { items: VideoItem[] }) {
  const [tab, setTab] = useState("all");
  const counts = useMemo(
    () => ({
      all: items.length,
      required: items.filter((i) => i.required).length,
      todo: items.filter((i) => !i.done).length,
      done: items.filter((i) => i.done).length,
    }),
    [items]
  );
  const shown = items.filter((i) => (tab === "required" ? i.required : tab === "todo" ? !i.done : tab === "done" ? i.done : true));
  const urgent = items.filter((i) => i.required && !i.done && (i.dueState === "OVERDUE" || i.dueState === "SOON"));

  return (
    <div className="space-y-4">
      {urgent.length > 0 && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            期限が近い・過ぎた必修動画が <strong>{urgent.length}本</strong> あります。先に視聴してください。
          </div>
        </div>
      )}

      <FilterTabs
        value={tab}
        onChange={setTab}
        options={[
          { value: "all", label: "すべて", count: counts.all },
          { value: "required", label: "必修", count: counts.required },
          { value: "todo", label: "未完了", count: counts.todo },
          { value: "done", label: "完了", count: counts.done },
        ]}
      />

      {shown.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">該当する動画はありません。</Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {shown.map((v) => (
            <Link key={v.id} href={`/videos/${v.id}`} prefetch={false} className="group block">
              <Card className="h-full overflow-hidden transition-shadow group-hover:shadow-md">
                <div className="relative aspect-video bg-navy/90">
                  {v.thumbnail ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={v.thumbnail} alt="" className="h-full w-full object-cover" loading="lazy" />
                  ) : (
                    <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-white/80">
                      <Clock className="h-8 w-8" />
                      <span className="text-sm font-medium">準備中</span>
                    </div>
                  )}
                  {v.thumbnail && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <PlayCircle className="h-14 w-14 text-white drop-shadow-lg" />
                    </div>
                  )}
                  <span className="absolute bottom-2 right-2 rounded bg-black/75 px-1.5 py-0.5 text-xs font-medium tabular-nums text-white">
                    {fmtDuration(v.durationSec)}
                  </span>
                  {v.status === "IN_PROGRESS" && (
                    <div className="absolute inset-x-0 bottom-0 h-1 bg-white/30">
                      <div className="h-full bg-yellow-400" style={{ width: `${v.percent}%` }} />
                    </div>
                  )}
                </div>
                <div className="space-y-2 p-4">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {v.required && <Badge variant="bad">必修</Badge>}
                    <Badge variant="outline">{label(CATEGORIES, v.category)}</Badge>
                    {!v.isPublished && <Badge variant="muted">非公開</Badge>}
                    {!v.ready && <Badge variant="muted">準備中</Badge>}
                  </div>
                  <div className="text-base font-semibold leading-snug text-navy">{v.title}</div>
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={v.status} percent={v.percent} />
                    {v.bestScore !== null && <span className="text-xs text-muted-foreground">テスト最高 {v.bestScore}点</span>}
                  </div>
                  {v.dueDate && (
                    <div
                      className={`text-xs font-medium ${
                        v.done ? "text-muted-foreground" : v.dueState === "OVERDUE" ? "text-red-600" : v.dueState === "SOON" ? "text-yellow-700" : "text-muted-foreground"
                      }`}
                    >
                      期限 {fmtDueDate(v.dueDate)}
                      {!v.done && v.dueState === "OVERDUE" && "　期限を過ぎています"}
                      {!v.done && v.dueState === "SOON" && "　期限が近づいています"}
                    </div>
                  )}
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
