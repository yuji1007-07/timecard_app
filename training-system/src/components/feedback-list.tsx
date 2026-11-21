"use client";

import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FilterTabs } from "@/components/filter-tabs";
import { NO_SERIES_LABEL, POSITIONS, label } from "@/lib/constants";
import type { FeedbackRow } from "@/lib/feedback";

/** フィードバック一覧（シリーズ／動画／ブランド／店舗のタブで絞り込み） */
export function FeedbackList({ rows, showStoreTabs }: { rows: FeedbackRow[]; showStoreTabs: boolean }) {
  const [series, setSeries] = useState("");
  const [videoId, setVideoId] = useState("");
  const [brand, setBrand] = useState("");
  const [storeId, setStoreId] = useState("");
  const sName = (r: FeedbackRow) => r.series || NO_SERIES_LABEL;

  const seriesList = useMemo(() => [...new Set(rows.map(sName))], [rows]);
  const videos = useMemo(() => {
    const map = new Map<string, { id: string; title: string; order: number }>();
    for (const r of rows) if (!series || sName(r) === series) map.set(r.videoId, { id: r.videoId, title: r.videoTitle, order: r.videoOrder });
    return [...map.values()].sort((a, b) => a.order - b.order);
  }, [rows, series]);
  const brands = useMemo(() => [...new Set(rows.map((r) => r.brand))], [rows]);
  const stores = useMemo(() => [...new Map(rows.filter((r) => r.brand === brand).map((r) => [r.storeId, r.storeName])).entries()], [rows, brand]);

  const shown = rows.filter(
    (r) => (!series || sName(r) === series) && (!videoId || r.videoId === videoId) && (!brand || r.brand === brand) && (!storeId || r.storeId === storeId)
  );

  if (rows.length === 0) return <Card className="p-8 text-center text-sm text-muted-foreground">まだフィードバックはありません。</Card>;

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {seriesList.length > 1 && (
          <FilterTabs
            title="シリーズ"
            value={series}
            onChange={(v) => {
              setSeries(v);
              setVideoId("");
            }}
            options={[{ value: "", label: "すべて", count: rows.length }, ...seriesList.map((s) => ({ value: s, label: s, count: rows.filter((r) => sName(r) === s).length }))]}
          />
        )}
        <FilterTabs
          title="動画"
          value={videoId}
          onChange={setVideoId}
          options={[{ value: "", label: "すべて" }, ...videos.map((v) => ({ value: v.id, label: v.title, count: rows.filter((r) => r.videoId === v.id).length }))]}
        />
        {showStoreTabs && (
          <>
            <FilterTabs
              title="ブランド"
              value={brand}
              onChange={(v) => {
                setBrand(v);
                setStoreId("");
              }}
              options={[{ value: "", label: "すべて" }, ...brands.map((b) => ({ value: b, label: b, count: rows.filter((r) => r.brand === b).length }))]}
            />
            {brand && stores.length > 1 && (
              <FilterTabs title="店舗" value={storeId} onChange={setStoreId} options={[{ value: "", label: "すべて" }, ...stores.map(([id, name]) => ({ value: id, label: name }))]} />
            )}
          </>
        )}
      </div>

      <div className="text-sm text-muted-foreground" data-testid="feedback-count">
        {shown.length}件{shown.length !== rows.length ? ` / 全${rows.length}件` : ""}
      </div>

      {shown.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">該当するフィードバックはありません。</Card>
      ) : (
        <div className="space-y-3">
          {shown.map((r) => (
            <Card key={r.id} className="p-4" data-testid="feedback-row">
              <div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="font-semibold text-navy">{r.userName}</span>
                <span className="text-xs text-muted-foreground">
                  {showStoreTabs ? `${r.storeName} / ` : ""}
                  {label(POSITIONS, r.position)}
                </span>
                <span className="ml-auto text-xs text-muted-foreground">{r.date}</span>
              </div>
              <div className="mb-3 flex flex-wrap items-center gap-1.5 text-sm">
                {r.series && <Badge className="border-transparent bg-navy/10 text-navy">{r.series}</Badge>}
                <span className="text-muted-foreground">{r.videoTitle}</span>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-md bg-muted/50 p-3">
                  <div className="mb-1 text-xs font-medium text-muted-foreground">感想</div>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed">{r.impression || "（記入なし）"}</p>
                </div>
                <div className="rounded-md bg-green-50 p-3">
                  <div className="mb-1 text-xs font-medium text-green-800">今後の実用法</div>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed">{r.action || "（記入なし）"}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
