import Link from "next/link";
import type { AttendanceRow } from "@/lib/attendance";

export type StaffOpt = { id: string; name: string; count: number };

/** 一覧に含まれるスタッフの一覧（名前順） */
export function staffOptions(records: AttendanceRow[]): StaffOpt[] {
  const map = new Map<string, StaffOpt>();
  for (const r of records) {
    const cur = map.get(r.user.id);
    if (cur) cur.count += 1;
    else map.set(r.user.id, { id: r.user.id, name: r.user.name, count: 1 });
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, "ja"));
}

export function filterByUser(records: AttendanceRow[], userId: string): AttendanceRow[] {
  return userId ? records.filter((r) => r.user.id === userId) : records;
}

/** スタッフ別の絞り込みタブ */
export function StaffTabs({ basePath, qs, staff, userId }: { basePath: string; qs: string; staff: StaffOpt[]; userId: string }) {
  if (staff.length === 0) return null;
  const pill = (active: boolean) =>
    `rounded-full px-3 py-1 text-sm whitespace-nowrap ${active ? "bg-navy text-white" : "bg-muted hover:bg-muted/70"}`;
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <Link href={`${basePath}?${qs}`} className={pill(!userId)}>
        全員
      </Link>
      {staff.map((s) => (
        <Link key={s.id} href={`${basePath}?${qs}&userId=${s.id}`} className={pill(userId === s.id)}>
          {s.name}
          <span className="ml-1 text-xs opacity-70">{s.count}</span>
        </Link>
      ))}
    </div>
  );
}
