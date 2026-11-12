"use client";

import { useMemo, useState } from "react";
import { FilterTabs } from "@/components/filter-tabs";
import { StatusBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import { POSITIONS, POSITION_ORDER, label } from "@/lib/constants";
import { fmtDueDate } from "@/lib/time";
import type { ProgressMatrix } from "@/lib/progress";

/** ブランド／店舗／役職の絞り込み（進捗表と未完了者リストで共用） */
export function useStaffFilter(users: ProgressMatrix["users"], showStoreTabs: boolean) {
  const [brand, setBrand] = useState("");
  const [storeId, setStoreId] = useState("");
  const [position, setPosition] = useState("");

  const brands = useMemo(() => [...new Set(users.map((u) => u.brand))], [users]);
  const stores = useMemo(() => {
    const map = new Map<string, string>();
    for (const u of users) if (u.storeId && (!brand || u.brand === brand)) map.set(u.storeId, u.storeName);
    return [...map.entries()].map(([id, name]) => ({ id, name }));
  }, [users, brand]);
  const positions = POSITION_ORDER.filter((p) => users.some((u) => u.position === p));

  const filtered = users.filter(
    (u) => (!brand || u.brand === brand) && (!storeId || u.storeId === storeId) && (!position || u.position === position)
  );

  const tabs = (
    <>
      {showStoreTabs && (
        <>
          <FilterTabs
            title="ブランド"
            value={brand}
            onChange={(v) => {
              setBrand(v);
              setStoreId("");
            }}
            options={[{ value: "", label: "すべて", count: users.length }, ...brands.map((b) => ({ value: b, label: b, count: users.filter((u) => u.brand === b).length }))]}
          />
          {brand ? (
            <FilterTabs
              title="店舗"
              value={storeId}
              onChange={setStoreId}
              options={[{ value: "", label: "すべて" }, ...stores.map((s) => ({ value: s.id, label: s.name, count: users.filter((u) => u.storeId === s.id).length }))]}
            />
          ) : (
            <div className="flex items-center gap-2">
              <div className="w-14 shrink-0 text-xs font-medium text-muted-foreground">店舗</div>
              <div className="text-xs text-muted-foreground">ブランドを選ぶと、店舗で絞り込めます。</div>
            </div>
          )}
        </>
      )}
      <FilterTabs
        title="役職"
        value={position}
        onChange={setPosition}
        options={[{ value: "", label: "すべて" }, ...positions.map((p) => ({ value: p, label: POSITIONS[p] }))]}
      />
    </>
  );
  return { filtered, tabs };
}

/** 2026-11-12 → 11/12 */
const md = (date: string) => `${Number(date.slice(5, 7))}/${Number(date.slice(8, 10))}`;

/** 進捗表：スタッフ×動画 */
export function ProgressTable({ matrix, showStoreTabs }: { matrix: ProgressMatrix; showStoreTabs: boolean }) {
  const { filtered, tabs } = useStaffFilter(matrix.users, showStoreTabs);
  const [videoId, setVideoId] = useState("");
  const videos = videoId ? matrix.videos.filter((v) => v.id === videoId) : matrix.videos;
  // 動画で絞ったときは、その動画が対象の人だけ表示
  const rows = videoId ? filtered.filter((u) => matrix.cells[u.id][videoId]?.target) : filtered;

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {tabs}
        <FilterTabs
          title="動画"
          value={videoId}
          onChange={setVideoId}
          options={[{ value: "", label: "すべて" }, ...matrix.videos.map((v) => ({ value: v.id, label: v.title }))]}
        />
      </div>

      <div className="text-sm text-muted-foreground" data-testid="progress-count">
        表示 {rows.length}名{rows.length !== matrix.users.length ? ` / 全${matrix.users.length}名` : ""}
      </div>

      {rows.length === 0 ? (
        <div className="rounded-lg border p-8 text-center text-sm text-muted-foreground">該当するスタッフはいません。</div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full min-w-max border-collapse text-sm">
            <thead>
              <tr className="border-b bg-muted/50 text-left">
                <th className="sticky left-0 z-10 bg-muted px-3 py-2.5 font-medium">スタッフ</th>
                {videos.map((v) => (
                  <th key={v.id} className="min-w-[9.5rem] max-w-[13rem] px-3 py-2.5 align-top font-medium">
                    <div className="whitespace-normal leading-snug">{v.title}</div>
                    {v.dueDate && <div className="mt-0.5 text-xs font-normal text-muted-foreground">期限 {fmtDueDate(v.dueDate)}</div>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((u) => (
                <tr key={u.id} className="border-b last:border-0" data-testid="progress-row">
                  <td className="sticky left-0 z-10 max-w-[11rem] bg-card px-3 py-2.5 align-top">
                    <div className="font-medium">{u.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {showStoreTabs && <span className="block truncate">{u.storeName}</span>}
                      {label(POSITIONS, u.position)}
                    </div>
                  </td>
                  {videos.map((v) => {
                    const c = matrix.cells[u.id][v.id];
                    if (!c.target) {
                      return (
                        <td key={v.id} className="bg-muted/30 px-3 py-2.5 text-center text-xs text-muted-foreground">
                          対象外
                        </td>
                      );
                    }
                    return (
                      <td key={v.id} className="px-3 py-2.5 align-top">
                        <div className="flex flex-wrap items-center gap-1">
                          <StatusBadge status={c.status} percent={c.percent} />
                          {c.required && !c.done && <Badge variant="bad">必修</Badge>}
                        </div>
                        {c.bestScore !== null && (
                          <div className="mt-1 text-xs text-muted-foreground">
                            最高 <span className={`font-semibold ${c.status === "PASSED" ? "text-green-700" : "text-red-600"}`}>{c.bestScore}点</span>（{c.attempts}回）
                          </div>
                        )}
                        {c.completedOn && <div className="text-xs text-muted-foreground">初回完了 {md(c.completedOn)}</div>}
                        {c.viewCount > 0 && (
                          <div className="text-xs text-muted-foreground" data-testid="view-info">
                            視聴 <span className={`font-semibold ${c.viewCount >= 2 ? "text-navy" : ""}`}>{c.viewCount}回</span>
                            {c.lastViewedOn && <>・最終 {md(c.lastViewedOn)}</>}
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/** 必修動画の未完了者リスト（期限切れは赤） */
export function IncompleteList({ matrix, showStoreTabs, today }: { matrix: ProgressMatrix; showStoreTabs: boolean; today: string }) {
  const { filtered, tabs } = useStaffFilter(matrix.users, showStoreTabs);
  const [videoId, setVideoId] = useState("");

  const requiredVideos = matrix.videos.filter((v) => matrix.users.some((u) => matrix.cells[u.id][v.id].required));
  const rows = filtered
    .flatMap((u) =>
      matrix.videos
        .filter((v) => (!videoId || v.id === videoId) && matrix.cells[u.id][v.id].required && !matrix.cells[u.id][v.id].done)
        .map((v) => ({ u, v, c: matrix.cells[u.id][v.id], overdue: !!v.dueDate && v.dueDate < today }))
    )
    .sort((a, b) => Number(b.overdue) - Number(a.overdue) || (a.v.dueDate ?? "9999").localeCompare(b.v.dueDate ?? "9999"));
  const overdueCount = rows.filter((r) => r.overdue).length;

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {tabs}
        <FilterTabs
          title="動画"
          value={videoId}
          onChange={setVideoId}
          options={[{ value: "", label: "すべて" }, ...requiredVideos.map((v) => ({ value: v.id, label: v.title }))]}
        />
      </div>
      <div className="text-sm text-muted-foreground" data-testid="incomplete-count">
        未完了 {rows.length}件{overdueCount > 0 && <span className="ml-2 font-semibold text-red-600">うち期限切れ {overdueCount}件</span>}
      </div>
      {rows.length === 0 ? (
        <div className="rounded-lg border p-8 text-center text-sm text-muted-foreground">必修動画の未完了者はいません。</div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full min-w-[40rem] text-sm">
            <thead>
              <tr className="border-b bg-muted/50 text-left">
                <th className="px-3 py-2.5 font-medium">スタッフ</th>
                <th className="px-3 py-2.5 font-medium">動画</th>
                <th className="px-3 py-2.5 font-medium">期限</th>
                <th className="px-3 py-2.5 font-medium">状態</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ u, v, c, overdue }) => (
                <tr key={`${u.id}:${v.id}`} className={`border-b last:border-0 ${overdue ? "bg-red-50" : ""}`} data-testid="incomplete-row">
                  <td className="px-3 py-2.5">
                    <div className="font-medium">{u.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {showStoreTabs ? `${u.storeName} / ` : ""}
                      {label(POSITIONS, u.position)}
                    </div>
                  </td>
                  <td className="px-3 py-2.5">{v.title}</td>
                  <td className={`whitespace-nowrap px-3 py-2.5 ${overdue ? "font-bold text-red-600" : ""}`}>
                    {v.dueDate ? fmtDueDate(v.dueDate) : "期限なし"}
                    {overdue && <span className="block text-xs">期限切れ</span>}
                  </td>
                  <td className="px-3 py-2.5">
                    <StatusBadge status={c.status} percent={c.percent} />
                    {c.status === "COMPLETED" && v.hasQuiz && (
                      <div className="mt-1 text-xs text-muted-foreground">{c.attempts > 0 ? `テスト未合格（最高${c.bestScore}点）` : "テスト未受験"}</div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
