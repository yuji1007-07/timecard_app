"use client";

export type StaffOpt = { id: string; name: string; count: number };

/** 一覧に含まれるスタッフの一覧（名前順） */
export function staffOptions(records: { user: { id: string; name: string } }[]): StaffOpt[] {
  const map = new Map<string, StaffOpt>();
  for (const r of records) {
    const cur = map.get(r.user.id);
    if (cur) cur.count += 1;
    else map.set(r.user.id, { id: r.user.id, name: r.user.name, count: 1 });
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, "ja"));
}

/** スタッフ別の絞り込みタブ（クライアント側で即時切り替え） */
export function StaffTabs({ staff, userId, onSelect }: { staff: StaffOpt[]; userId: string; onSelect: (id: string) => void }) {
  if (staff.length === 0) return null;
  const cls = (active: boolean) =>
    `h-11 rounded-lg border px-4 text-base font-medium whitespace-nowrap transition-colors ${
      active ? "border-navy bg-navy text-white" : "border-input bg-background hover:bg-muted"
    }`;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" className={cls(!userId)} onClick={() => onSelect("")}>
        全員
      </button>
      {staff.map((s) => (
        <button key={s.id} type="button" className={cls(userId === s.id)} onClick={() => onSelect(s.id)}>
          {s.name}
          <span className="ml-1.5 text-xs opacity-70">{s.count}</span>
        </button>
      ))}
    </div>
  );
}
