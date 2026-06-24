"use client";

import { useActionState, useState } from "react";
import { createKpiItem, updateKpiItem } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UNITS, INPUT_TYPES, GOOD_DIRECTIONS } from "@/lib/constants";

const selectClass =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export type KpiItemData = {
  id: string;
  name: string;
  unit: string;
  inputType: string;
  goodDirection: string;
  hasTarget: boolean;
  hasCurrent: boolean;
  hasForecast: boolean;
  hasComparison: boolean;
  showGraph: boolean;
  showDashboard: boolean;
  required: boolean;
};

const FLAGS: { key: keyof KpiItemData; label: string }[] = [
  { key: "hasTarget", label: "目標入力" },
  { key: "hasCurrent", label: "現状入力" },
  { key: "hasForecast", label: "着地予測入力" },
  { key: "hasComparison", label: "前回比較" },
  { key: "showGraph", label: "グラフ表示" },
  { key: "showDashboard", label: "ダッシュボード表示" },
  { key: "required", label: "必須入力" },
];

export function KpiItemForm({
  level,
  scopeKey,
  item,
  onDone,
}: {
  level: string;
  scopeKey: string;
  item?: KpiItemData;
  onDone?: () => void;
}) {
  const isEdit = !!item;
  const [state, action, pending] = useActionState(isEdit ? updateKpiItem : createKpiItem, null);
  if (state?.success && onDone) onDone();

  return (
    <form action={action} className="grid gap-3 rounded-md border bg-muted/30 p-4 md:grid-cols-2">
      {isEdit && <input type="hidden" name="id" value={item!.id} />}
      <input type="hidden" name="level" value={level} />
      <input type="hidden" name="scopeKey" value={scopeKey} />

      <div className="space-y-1.5">
        <Label>KPI名 *</Label>
        <Input name="name" defaultValue={item?.name} required />
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div className="space-y-1.5">
          <Label>単位</Label>
          <select name="unit" className={selectClass} defaultValue={item?.unit ?? "円"}>
            {UNITS.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label>入力形式</Label>
          <select name="inputType" className={selectClass} defaultValue={item?.inputType ?? "NUMBER"}>
            {Object.entries(INPUT_TYPES).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label>良化方向</Label>
          <select name="goodDirection" className={selectClass} defaultValue={item?.goodDirection ?? "UP"}>
            {Object.entries(GOOD_DIRECTIONS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="md:col-span-2">
        <Label className="mb-2 block">入力・表示オプション</Label>
        <div className="flex flex-wrap gap-3">
          {FLAGS.map((f) => (
            <label key={f.key} className="flex items-center gap-1.5 text-sm">
              <input
                type="checkbox"
                name={f.key}
                defaultChecked={item ? (item[f.key] as boolean) : ["hasTarget", "hasCurrent", "hasForecast", "hasComparison", "showGraph"].includes(f.key)}
                className="h-4 w-4 rounded border-input"
              />
              {f.label}
            </label>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2 md:col-span-2">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "保存中..." : isEdit ? "更新する" : "KPIを追加"}
        </Button>
        {onDone && (
          <Button type="button" size="sm" variant="ghost" onClick={onDone}>
            閉じる
          </Button>
        )}
        {state?.error && <span className="text-sm text-destructive">{state.error}</span>}
      </div>
    </form>
  );
}

export function AddKpiToggle({ level, scopeKey }: { level: string; scopeKey: string }) {
  const [open, setOpen] = useState(false);
  if (!open)
    return (
      <Button size="sm" onClick={() => setOpen(true)}>
        ＋ KPI項目を追加
      </Button>
    );
  return <KpiItemForm level={level} scopeKey={scopeKey} onDone={() => setOpen(false)} />;
}

export function EditKpiToggle({ level, scopeKey, item }: { level: string; scopeKey: string; item: KpiItemData }) {
  const [open, setOpen] = useState(false);
  if (!open)
    return (
      <Button size="sm" variant="ghost" onClick={() => setOpen(true)}>
        編集
      </Button>
    );
  return (
    <div className="md:col-span-full">
      <KpiItemForm level={level} scopeKey={scopeKey} item={item} onDone={() => setOpen(false)} />
    </div>
  );
}
