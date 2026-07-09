"use client";

import { useRouter } from "next/navigation";
import { Label } from "@/components/ui/label";
import { monthWeek, MONTH_WEEK_RANGES } from "@/lib/utils";

const selectClass =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export type StoreOpt = { id: string; name: string; businessType: string; departments: { id: string; name: string }[] };

// 週の期間文字列（YYYY-MM-Wn）を 月(YYYY-MM) と 週番号 に分解。旧形式・不正値は今日基準に補正
function parseWeekPeriod(period: string): { ym: string; wn: number } {
  const m = /^(\d{4}-\d{2})-W([1-5])$/.exec(period);
  if (m) return { ym: m[1], wn: Number(m[2]) };
  const now = monthWeek(new Date());
  const n = /^(\d{4}-\d{2})-W([1-5])$/.exec(now)!;
  return { ym: n[1], wn: Number(n[2]) };
}

export function ReportSetup({
  stores,
  canPickStore,
  canPickDepartment,
  storeId,
  departmentId,
  type,
  period,
}: {
  stores: StoreOpt[];
  canPickStore: boolean;
  canPickDepartment: boolean;
  storeId: string | null;
  departmentId: string | null;
  type: "WEEKLY" | "MONTHLY";
  period: string;
}) {
  const router = useRouter();
  const current = stores.find((s) => s.id === storeId);

  function go(next: { storeId?: string | null; departmentId?: string | null; type?: string; period?: string }) {
    const sid = next.storeId !== undefined ? next.storeId : storeId;
    const did = next.departmentId !== undefined ? next.departmentId : departmentId;
    const t = next.type ?? type;
    const p = next.period ?? period;
    const params = new URLSearchParams();
    if (sid) params.set("storeId", sid);
    if (did) params.set("departmentId", did);
    params.set("type", t);
    params.set("period", p);
    router.push(`/reports/new?${params.toString()}`);
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {canPickStore && (
        <div className="space-y-1.5">
          <Label>店舗</Label>
          <select className={selectClass} value={storeId ?? ""} onChange={(e) => go({ storeId: e.target.value || null, departmentId: null })}>
            <option value="">選択してください</option>
            {stores.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
      )}

      {canPickDepartment && current && current.departments.length > 0 && (
        <div className="space-y-1.5">
          <Label>部門</Label>
          <select className={selectClass} value={departmentId ?? ""} onChange={(e) => go({ departmentId: e.target.value || null })}>
            <option value="">部門を選択</option>
            {current.departments.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>
      )}

      <div className="space-y-1.5">
        <Label>報告区分</Label>
        <select
          className={selectClass}
          value={type}
          onChange={(e) => {
            const t = e.target.value as "WEEKLY" | "MONTHLY";
            // 区分を切り替えたら期間フォーマットも切り替え
            const now = new Date();
            const p = t === "MONTHLY" ? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}` : monthWeek(now);
            go({ type: t, period: p });
          }}
        >
          <option value="WEEKLY">週次</option>
          <option value="MONTHLY">月次</option>
        </select>
      </div>

      {type === "WEEKLY" ? (
        (() => {
          const { ym, wn } = parseWeekPeriod(period);
          return (
            <>
              <div className="space-y-1.5">
                <Label>対象月</Label>
                <input
                  type="month"
                  className={selectClass}
                  value={ym}
                  onChange={(e) => e.target.value && go({ period: `${e.target.value}-W${wn}` })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>対象週</Label>
                <select className={selectClass} value={wn} onChange={(e) => go({ period: `${ym}-W${e.target.value}` })}>
                  {MONTH_WEEK_RANGES.map((range, i) => (
                    <option key={i + 1} value={i + 1}>第{i + 1}週（{range}）</option>
                  ))}
                </select>
              </div>
            </>
          );
        })()
      ) : (
        <div className="space-y-1.5">
          <Label>対象月</Label>
          <input type="month" className={selectClass} value={period} onChange={(e) => go({ period: e.target.value })} />
        </div>
      )}
    </div>
  );
}
