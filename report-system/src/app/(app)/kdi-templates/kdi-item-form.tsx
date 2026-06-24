"use client";

import { useActionState, useState } from "react";
import { createKdiItem, updateKdiItem } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FREQUENCIES } from "@/lib/constants";

const selectClass =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export type KdiItemData = {
  id: string;
  name: string;
  category: string | null;
  relatedKpiName: string | null;
  recommendedFrequency: string;
  hasAssignee: boolean;
  hasDeadline: boolean;
  hasCount: boolean;
  hasTargetPerson: boolean;
  hasStatus: boolean;
  note: string | null;
};

const FLAGS: { key: keyof KdiItemData; label: string }[] = [
  { key: "hasAssignee", label: "担当者入力" },
  { key: "hasDeadline", label: "期限入力" },
  { key: "hasCount", label: "実施回数入力" },
  { key: "hasTargetPerson", label: "対象者入力" },
  { key: "hasStatus", label: "進捗ステータス入力" },
];

function KdiItemForm({ level, scopeKey, item, onDone }: { level: string; scopeKey: string; item?: KdiItemData; onDone?: () => void }) {
  const isEdit = !!item;
  const [state, action, pending] = useActionState(isEdit ? updateKdiItem : createKdiItem, null);
  if (state?.success && onDone) onDone();

  return (
    <form action={action} className="grid gap-3 rounded-md border bg-muted/30 p-4 md:grid-cols-2">
      {isEdit && <input type="hidden" name="id" value={item!.id} />}
      <input type="hidden" name="level" value={level} />
      <input type="hidden" name="scopeKey" value={scopeKey} />

      <div className="space-y-1.5">
        <Label>KDI名 *</Label>
        <Input name="name" defaultValue={item?.name} required />
      </div>
      <div className="space-y-1.5">
        <Label>カテゴリ</Label>
        <Input name="category" defaultValue={item?.category ?? ""} placeholder="成約率関連 など" />
      </div>
      <div className="space-y-1.5">
        <Label>関連KPI</Label>
        <Input name="relatedKpiName" defaultValue={item?.relatedKpiName ?? ""} placeholder="成約率 など" />
      </div>
      <div className="space-y-1.5">
        <Label>推奨実施頻度</Label>
        <select name="recommendedFrequency" className={selectClass} defaultValue={item?.recommendedFrequency ?? "WEEKLY1"}>
          {Object.entries(FREQUENCIES).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </div>

      <div className="md:col-span-2">
        <Label className="mb-2 block">入力項目オプション</Label>
        <div className="flex flex-wrap gap-3">
          {FLAGS.map((f) => (
            <label key={f.key} className="flex items-center gap-1.5 text-sm">
              <input
                type="checkbox"
                name={f.key}
                defaultChecked={item ? (item[f.key] as boolean) : ["hasAssignee", "hasDeadline", "hasCount", "hasStatus"].includes(f.key)}
                className="h-4 w-4 rounded border-input"
              />
              {f.label}
            </label>
          ))}
        </div>
      </div>

      <div className="space-y-1.5 md:col-span-2">
        <Label>備考</Label>
        <Input name="note" defaultValue={item?.note ?? ""} />
      </div>

      <div className="flex items-center gap-2 md:col-span-2">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "保存中..." : isEdit ? "更新する" : "KDIを追加"}
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

export function AddKdiToggle({ level, scopeKey }: { level: string; scopeKey: string }) {
  const [open, setOpen] = useState(false);
  if (!open)
    return (
      <Button size="sm" onClick={() => setOpen(true)}>
        ＋ KDI項目を追加
      </Button>
    );
  return <KdiItemForm level={level} scopeKey={scopeKey} onDone={() => setOpen(false)} />;
}

export function EditKdiToggle({ level, scopeKey, item }: { level: string; scopeKey: string; item: KdiItemData }) {
  const [open, setOpen] = useState(false);
  if (!open)
    return (
      <Button size="sm" variant="ghost" onClick={() => setOpen(true)}>
        編集
      </Button>
    );
  return (
    <div className="md:col-span-full">
      <KdiItemForm level={level} scopeKey={scopeKey} item={item} onDone={() => setOpen(false)} />
    </div>
  );
}
