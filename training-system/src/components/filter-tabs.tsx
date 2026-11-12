"use client";

export type TabOption = { value: string; label: string; count?: number };

/** 絞り込みタブ（クライアント側で即時切り替え。指で押しやすい高さ） */
export function FilterTabs({
  title,
  options,
  value,
  onChange,
}: {
  title?: string;
  options: TabOption[];
  value: string;
  onChange: (value: string) => void;
}) {
  if (options.length === 0) return null;
  const cls = (active: boolean) =>
    `h-11 shrink-0 rounded-lg border px-4 text-sm font-medium whitespace-nowrap transition-colors ${
      active ? "border-navy bg-navy text-white" : "border-input bg-background hover:bg-muted"
    }`;
  return (
    <div className="flex items-start gap-2">
      {title && <div className="w-14 shrink-0 pt-3 text-xs font-medium text-muted-foreground">{title}</div>}
      <div className="flex flex-wrap items-center gap-2">
        {options.map((o) => (
          <button key={o.value} type="button" aria-pressed={value === o.value} className={cls(value === o.value)} onClick={() => onChange(o.value)}>
            {o.label}
            {o.count !== undefined && <span className="ml-1.5 text-xs opacity-70">{o.count}</span>}
          </button>
        ))}
      </div>
    </div>
  );
}
