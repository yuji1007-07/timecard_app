"use client";

import { useRouter } from "next/navigation";
import { Label } from "@/components/ui/label";

export type ScopeOption = { value: string; label: string; group: string };

const selectClass =
  "flex h-10 w-full max-w-md rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

/** テンプレート編集対象スコープ（業態/店舗/部門）を選ぶ。value は "level:key"。 */
export function ScopeSelector({
  basePath,
  options,
  current,
}: {
  basePath: string;
  options: ScopeOption[];
  current: string;
}) {
  const router = useRouter();
  const groups = Array.from(new Set(options.map((o) => o.group)));

  return (
    <div className="space-y-1.5">
      <Label htmlFor="scope">編集対象スコープ</Label>
      <select
        id="scope"
        className={selectClass}
        value={current}
        onChange={(e) => {
          const [level, key] = e.target.value.split(":");
          router.push(`${basePath}?level=${level}&key=${key}`);
        }}
      >
        {groups.map((g) => (
          <optgroup key={g} label={g}>
            {options
              .filter((o) => o.group === g)
              .map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
          </optgroup>
        ))}
      </select>
    </div>
  );
}
