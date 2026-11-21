"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronUp } from "lucide-react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FilterTabs } from "@/components/filter-tabs";
import { NO_SERIES_LABEL } from "@/lib/constants";
import { moveVideo } from "./actions";

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

/** 並び替えボタン1つ分（上へ or 下へ）。series を渡すと、そのシリーズの中で入れ替える */
function MoveButton({ id, title, series, dir, disabled }: { id: string; title: string; series: string | null; dir: "up" | "down"; disabled: boolean }) {
  const [state, action, pending] = useActionState(moveVideo, null);
  const router = useRouter();
  useEffect(() => {
    if (state?.success) router.refresh();
  }, [state, router]);
  const text = dir === "up" ? "1つ上へ" : "1つ下へ";
  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="dir" value={dir} />
      {series !== null && <input type="hidden" name="series" value={series} />}
      <button
        type="submit"
        className="flex h-9 w-10 items-center justify-center rounded-md border border-input bg-background hover:bg-muted disabled:opacity-30"
        disabled={pending || disabled}
        aria-label={`${title} を${text}`}
        title={text}
        data-dir={dir}
      >
        {dir === "up" ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
      </button>
    </form>
  );
}

function MoveButtons({ id, title, series, isFirst, isLast }: { id: string; title: string; series: string | null; isFirst: boolean; isLast: boolean }) {
  return (
    <div className="flex shrink-0 flex-col gap-1">
      <MoveButton id={id} title={title} series={series} dir="up" disabled={isFirst} />
      <MoveButton id={id} title={title} series={series} dir="down" disabled={isLast} />
    </div>
  );
}

/** 動画一覧（シリーズのタブで絞り込み。▲▼ で並び替え） */
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
        {shown.map((v, i) => (
          <div key={v.id} className="flex items-center gap-3 px-4 py-4 md:px-5" data-testid="admin-video-row">
            <MoveButtons id={v.id} title={v.title} series={series ? v.series : null} isFirst={i === 0} isLast={i === shown.length - 1} />
            <div className="w-6 shrink-0 text-center text-sm font-semibold tabular-nums text-muted-foreground">{i + 1}</div>
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3">
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
          </div>
        ))}
        {shown.length === 0 && <div className="p-8 text-center text-sm text-muted-foreground">動画がまだありません。</div>}
      </CardContent>
    </Card>
  );
}
