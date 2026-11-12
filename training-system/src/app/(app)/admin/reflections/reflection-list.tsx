"use client";

import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { StatCard } from "@/components/stat-card";
import { FilterTabs } from "@/components/filter-tabs";
import { POSITIONS, label } from "@/lib/constants";

export type ReflectionRow = {
  id: string;
  videoId: string;
  videoTitle: string;
  videoOrder: number;
  userName: string;
  position: string;
  storeName: string;
  brand: string;
  selfRating: number;
  action: string;
  date: string;
};

const avg = (list: ReflectionRow[]) => (list.length ? (list.reduce((a, r) => a + r.selfRating, 0) / list.length).toFixed(1) : "-");

export function ReflectionList({ rows }: { rows: ReflectionRow[] }) {
  const [videoId, setVideoId] = useState("");
  const [brand, setBrand] = useState("");
  const videos = useMemo(() => {
    const map = new Map<string, { id: string; title: string; order: number }>();
    for (const r of rows) map.set(r.videoId, { id: r.videoId, title: r.videoTitle, order: r.videoOrder });
    return [...map.values()].sort((a, b) => a.order - b.order);
  }, [rows]);
  const brands = useMemo(() => [...new Set(rows.map((r) => r.brand))], [rows]);
  const shown = rows.filter((r) => (!videoId || r.videoId === videoId) && (!brand || r.brand === brand));

  if (rows.length === 0) return <Card className="p-8 text-center text-sm text-muted-foreground">まだふりかえりはありません。</Card>;

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <FilterTabs
          title="動画"
          value={videoId}
          onChange={setVideoId}
          options={[{ value: "", label: "すべて", count: rows.length }, ...videos.map((v) => ({ value: v.id, label: v.title, count: rows.filter((r) => r.videoId === v.id).length }))]}
        />
        <FilterTabs title="ブランド" value={brand} onChange={setBrand} options={[{ value: "", label: "すべて" }, ...brands.map((b) => ({ value: b, label: b }))]} />
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="自己評価の平均" value={avg(shown)} sub="5点満点" />
        <StatCard label="件数" value={`${shown.length}件`} />
        <StatCard label="評価1〜2（不安あり）" value={`${shown.filter((r) => r.selfRating <= 2).length}件`} tone={shown.some((r) => r.selfRating <= 2) ? "bad" : "default"} />
        <StatCard label="評価4〜5" value={`${shown.filter((r) => r.selfRating >= 4).length}件`} tone="good" />
      </div>
      <Card>
        <CardContent className="divide-y p-0">
          {shown.map((r) => (
            <div key={r.id} className="flex gap-3 p-4" data-testid="reflection-row">
              <div
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-lg font-bold ${
                  r.selfRating <= 2 ? "bg-red-100 text-red-700" : r.selfRating === 3 ? "bg-yellow-100 text-yellow-800" : "bg-green-100 text-green-800"
                }`}
              >
                {r.selfRating}
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-medium leading-relaxed">{r.action}</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {r.userName}（{r.storeName} / {label(POSITIONS, r.position)}）・{r.videoTitle}・{r.date}
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
