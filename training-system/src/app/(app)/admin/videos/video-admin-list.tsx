"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FilterTabs } from "@/components/filter-tabs";
import { NO_SERIES_LABEL } from "@/lib/constants";

export type AdminVideoRow = {
  id: string;
  title: string;
  series: string;
  categoryLabel: string;
  audienceLabel: string;
  requiredLabel: string | null;
  assignments: number;
  hasUrl: boolean;
  isPublished: boolean;
  meta: string;
};

/** 動画一覧（シリーズのタブで絞り込み） */
export function VideoAdminList({ videos, editLabel }: { videos: AdminVideoRow[]; editLabel: string }) {
  const [series, setSeries] = useState("");
  const sName = (v: AdminVideoRow) => v.series || NO_SERIES_LABEL;
  const seriesList = useMemo(() => [...new Set(videos.map(sName))], [videos]);
  const shown = series ? videos.filter((v) => sName(v) === series) : videos;

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          動画一覧（{shown.length}本{shown.length !== videos.length ? ` / 全${videos.length}本` : ""}）
        </CardTitle>
        {seriesList.length > 1 && (
          <div className="pt-3">
            <FilterTabs
              title="シリーズ"
              value={series}
              onChange={setSeries}
              options={[{ value: "", label: "すべて", count: videos.length }, ...seriesList.map((s) => ({ value: s, label: s, count: videos.filter((v) => sName(v) === s).length }))]}
            />
          </div>
        )}
      </CardHeader>
      <CardContent className="divide-y p-0">
        {shown.map((v) => (
          <div key={v.id} className="flex flex-wrap items-center gap-3 px-5 py-4" data-testid="admin-video-row">
            <div className="min-w-0 flex-1 basis-64">
              <div className="font-semibold text-navy">{v.title}</div>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                <Badge className="border-transparent bg-navy/10 text-navy">{sName(v)}</Badge>
                <Badge variant="outline">{v.categoryLabel}</Badge>
                <Badge variant="outline">対象: {v.audienceLabel}</Badge>
                {v.assignments > 0 && <Badge className="border-transparent bg-purple-100 text-purple-800">個人指定 {v.assignments}名</Badge>}
                {v.requiredLabel && <Badge variant="bad">{v.requiredLabel}</Badge>}
                {v.hasUrl ? <Badge variant="good">URL登録済み</Badge> : <Badge variant="warn">準備中（URL未登録）</Badge>}
                {!v.isPublished && <Badge variant="muted">非公開</Badge>}
              </div>
              <div className="mt-1.5 text-xs text-muted-foreground">{v.meta}</div>
            </div>
            <Button asChild variant="outline">
              <Link href={`/admin/videos/${v.id}`} prefetch={false}>
                {editLabel}
              </Link>
            </Button>
          </div>
        ))}
        {shown.length === 0 && <div className="p-8 text-center text-sm text-muted-foreground">動画がまだありません。</div>}
      </CardContent>
    </Card>
  );
}
