"use client";

import { useActionState, useState } from "react";
import { createAlert, updateAlert } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ALERT_TARGET_TYPES, ALERT_OPERATORS, ALERT_COLORS, PRIORITIES } from "@/lib/constants";

const selectClass =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export type AlertData = {
  id: string;
  name: string;
  targetType: string;
  storeId: string | null;
  departmentId: string | null;
  targetKpi: string | null;
  operator: string;
  threshold: number | null;
  color: string;
  priority: string;
  notify: boolean;
  enabled: boolean;
};

type Opt = { id: string; name: string };

export function AlertForm({
  stores,
  departments,
  item,
  onDone,
}: {
  stores: Opt[];
  departments: Opt[];
  item?: AlertData;
  onDone?: () => void;
}) {
  const isEdit = !!item;
  const [state, action, pending] = useActionState(isEdit ? updateAlert : createAlert, null);
  const [targetType, setTargetType] = useState(item?.targetType ?? "ALL");
  if (state?.success && onDone) onDone();

  return (
    <form action={action} className="grid gap-3 rounded-md border bg-muted/30 p-4 md:grid-cols-2">
      {isEdit && <input type="hidden" name="id" value={item!.id} />}

      <div className="space-y-1.5 md:col-span-2">
        <Label>条件名 *</Label>
        <Input name="name" defaultValue={item?.name} placeholder="離反率が20%以上 など" required />
      </div>

      <div className="space-y-1.5">
        <Label>対象</Label>
        <select name="targetType" className={selectClass} value={targetType} onChange={(e) => setTargetType(e.target.value)}>
          {Object.entries(ALERT_TARGET_TYPES).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>

      {targetType === "STORE" && (
        <div className="space-y-1.5">
          <Label>対象店舗</Label>
          <select name="storeId" className={selectClass} defaultValue={item?.storeId ?? ""}>
            <option value="">選択</option>
            {stores.map((s) => (<option key={s.id} value={s.id}>{s.name}</option>))}
          </select>
        </div>
      )}
      {targetType === "DEPARTMENT" && (
        <div className="space-y-1.5">
          <Label>対象部門</Label>
          <select name="departmentId" className={selectClass} defaultValue={item?.departmentId ?? ""}>
            <option value="">選択</option>
            {departments.map((d) => (<option key={d.id} value={d.id}>{d.name}</option>))}
          </select>
        </div>
      )}

      <div className="space-y-1.5">
        <Label>対象KPI</Label>
        <Input name="targetKpi" defaultValue={item?.targetKpi ?? ""} placeholder="離反率（未提出/Action未実施は不要）" />
      </div>
      <div className="space-y-1.5">
        <Label>条件</Label>
        <select name="operator" className={selectClass} defaultValue={item?.operator ?? "GTE"}>
          {Object.entries(ALERT_OPERATORS).map(([k, v]) => (<option key={k} value={k}>{v}</option>))}
        </select>
      </div>
      <div className="space-y-1.5">
        <Label>閾値</Label>
        <Input name="threshold" type="number" step="any" defaultValue={item?.threshold ?? ""} placeholder="20 など" />
      </div>
      <div className="space-y-1.5">
        <Label>表示色</Label>
        <select name="color" className={selectClass} defaultValue={item?.color ?? "RED"}>
          {Object.entries(ALERT_COLORS).map(([k, v]) => (<option key={k} value={k}>{v}</option>))}
        </select>
      </div>
      <div className="space-y-1.5">
        <Label>優先度</Label>
        <select name="priority" className={selectClass} defaultValue={item?.priority ?? "MID"}>
          {Object.entries(PRIORITIES).map(([k, v]) => (<option key={k} value={k}>{v}</option>))}
        </select>
      </div>

      <div className="flex items-center gap-4 md:col-span-2">
        <label className="flex items-center gap-1.5 text-sm">
          <input type="checkbox" name="notify" defaultChecked={item?.notify ?? false} className="h-4 w-4 rounded border-input" />
          通知ON
        </label>
        <label className="flex items-center gap-1.5 text-sm">
          <input type="checkbox" name="enabled" defaultChecked={item?.enabled ?? true} className="h-4 w-4 rounded border-input" />
          有効
        </label>
      </div>

      <div className="flex items-center gap-2 md:col-span-2">
        <Button type="submit" size="sm" disabled={pending}>{pending ? "保存中..." : isEdit ? "更新する" : "条件を追加"}</Button>
        {onDone && <Button type="button" size="sm" variant="ghost" onClick={onDone}>閉じる</Button>}
        {state?.error && <span className="text-sm text-destructive">{state.error}</span>}
      </div>
    </form>
  );
}

export function AddAlertToggle({ stores, departments }: { stores: Opt[]; departments: Opt[] }) {
  const [open, setOpen] = useState(false);
  if (!open) return <Button size="sm" onClick={() => setOpen(true)}>＋ 要注意条件を追加</Button>;
  return <AlertForm stores={stores} departments={departments} onDone={() => setOpen(false)} />;
}

export function EditAlertToggle({ stores, departments, item }: { stores: Opt[]; departments: Opt[]; item: AlertData }) {
  const [open, setOpen] = useState(false);
  if (!open) return <Button size="sm" variant="ghost" onClick={() => setOpen(true)}>編集</Button>;
  return <div className="md:col-span-full"><AlertForm stores={stores} departments={departments} item={item} onDone={() => setOpen(false)} /></div>;
}
