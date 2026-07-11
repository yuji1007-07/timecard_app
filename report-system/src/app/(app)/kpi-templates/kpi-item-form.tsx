"use client";

import { useActionState, useState } from "react";
import { createKpiItem, updateKpiItem, bulkCreateKpiItems, deleteAllKpiItems } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { UNITS, INPUT_TYPES, GOOD_DIRECTIONS } from "@/lib/constants";

const selectClass =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export type KpiItemData = {
  id: string;
  name: string;
  category: string | null;
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
  categories = [],
  onDone,
}: {
  level: string;
  scopeKey: string;
  item?: KpiItemData;
  categories?: string[];
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
      <div className="space-y-1.5">
        <Label>大枠カテゴリ（色分けの見出し）</Label>
        <Input name="category" defaultValue={item?.category ?? ""} list="kpi-category-list" placeholder="例: 会員 / 骨盤（空欄なら「会員-〇〇」の接頭辞から自動）" />
        <datalist id="kpi-category-list">
          {categories.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
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

export function AddKpiToggle({ level, scopeKey, categories = [] }: { level: string; scopeKey: string; categories?: string[] }) {
  const [open, setOpen] = useState(false);
  if (!open)
    return (
      <Button size="sm" onClick={() => setOpen(true)}>
        ＋ KPI項目を追加
      </Button>
    );
  return <KpiItemForm level={level} scopeKey={scopeKey} categories={categories} onDone={() => setOpen(false)} />;
}

export function EditKpiToggle({ level, scopeKey, item, categories = [] }: { level: string; scopeKey: string; item: KpiItemData; categories?: string[] }) {
  const [open, setOpen] = useState(false);
  if (!open)
    return (
      <Button size="sm" variant="ghost" onClick={() => setOpen(true)}>
        編集
      </Button>
    );
  return (
    <div className="md:col-span-full">
      <KpiItemForm level={level} scopeKey={scopeKey} item={item} categories={categories} onDone={() => setOpen(false)} />
    </div>
  );
}

export function ClearScopeKpiButton({ level, scopeKey, count }: { level: string; scopeKey: string; count: number }) {
  if (count === 0) return null;
  return (
    <form
      action={deleteAllKpiItems}
      onSubmit={(e) => {
        if (!window.confirm(`このスコープのKPI ${count}件をすべて削除します。よろしいですか？（報告の過去データには影響しません）`)) e.preventDefault();
      }}
    >
      <input type="hidden" name="level" value={level} />
      <input type="hidden" name="scopeKey" value={scopeKey} />
      <Button type="submit" size="sm" variant="ghost" className="text-destructive hover:text-destructive">
        全削除（{count}件）
      </Button>
    </form>
  );
}

export function BulkAddKpi({ level, scopeKey }: { level: string; scopeKey: string }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(bulkCreateKpiItems, null);
  if (state?.success && open) setOpen(false);

  if (!open)
    return (
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        ＋ まとめて一括追加
      </Button>
    );

  return (
    <form action={action} className="w-full space-y-3 rounded-md border bg-muted/30 p-4">
      <input type="hidden" name="level" value={level} />
      <input type="hidden" name="scopeKey" value={scopeKey} />
      <div className="space-y-1.5">
        <Label>KPI名（1行に1つ）</Label>
        <Textarea name="names" rows={6} placeholder={"売上\n初診数\n会員数\nカルテ枚数"} />
        <p className="text-xs text-muted-foreground">改行で区切って入力すると、まとめて追加されます。「会員-カルテ枚数」のように「カテゴリ-項目名」で入力すると、接頭辞が大枠カテゴリ（色分けの見出し）に自動で入ります。単位や並び順は追加後に変更できます。</p>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label>大枠カテゴリ（任意・共通）</Label>
          <Input name="category" className="w-56" placeholder="空欄なら接頭辞から自動" />
        </div>
        <div className="space-y-1.5">
          <Label>単位</Label>
          <select name="unit" className={selectClass + " w-48"} defaultValue="AUTO">
            <option value="AUTO">自動判定（おすすめ）</option>
            {UNITS.map((u) => (
              <option key={u} value={u}>
                すべて {u}
              </option>
            ))}
          </select>
        </div>
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "追加中..." : "一括で追加する"}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
          閉じる
        </Button>
        {state?.error && <span className="text-sm text-destructive">{state.error}</span>}
      </div>
    </form>
  );
}
