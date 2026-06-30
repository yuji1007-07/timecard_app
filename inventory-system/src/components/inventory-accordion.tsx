"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { BrandBadge } from "@/components/badges";
import { yen } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { InventoryRow } from "@/lib/inventory";

type Group = { brandId: string; brandName: string; brandColor: string; rows: InventoryRow[] };

export function InventoryAccordion({ rows }: { rows: InventoryRow[] }) {
  // 在庫0は既定で非表示（在庫不足は0でも表示）。トグルで全表示に切替。
  const [showZero, setShowZero] = useState(false);
  const visible = showZero ? rows : rows.filter((r) => r.stock !== 0 || r.low);
  const hiddenCount = rows.length - visible.length;

  // ブランドごとにグルーピング
  const groups: Group[] = [];
  const idx = new Map<string, number>();
  for (const r of visible) {
    if (!idx.has(r.brandId)) {
      idx.set(r.brandId, groups.length);
      groups.push({ brandId: r.brandId, brandName: r.brandName, brandColor: r.brandColor, rows: [] });
    }
    groups[idx.get(r.brandId)!].rows.push(r);
  }

  return (
    <div className="space-y-3">
      <label className="flex items-center justify-end gap-2 text-xs text-muted-foreground">
        <input type="checkbox" checked={showZero} onChange={(e) => setShowZero(e.target.checked)} className="h-3.5 w-3.5" />
        在庫0の商品も表示{hiddenCount > 0 && !showZero ? `（${hiddenCount}件 非表示中）` : ""}
      </label>
      {groups.length === 0 ? (
        <p className="rounded-lg border bg-card p-6 text-center text-sm text-muted-foreground">
          表示する在庫がありません{rows.length > 0 ? "（在庫0のみ。上のチェックで表示できます）" : ""}。
        </p>
      ) : (
        groups.map((g) => <BrandGroup key={g.brandId} group={g} />)
      )}
    </div>
  );
}

function BrandGroup({ group }: { group: Group }) {
  const [open, setOpen] = useState(true);
  const totalValue = group.rows.reduce((s, r) => s + r.stockValueWholesale, 0);
  const lowCount = group.rows.filter((r) => r.low).length;

  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 bg-secondary/40 px-4 py-3 text-left"
      >
        <div className="flex items-center gap-3">
          <BrandBadge name={group.brandName} color={group.brandColor} />
          <span className="text-xs text-muted-foreground">{group.rows.length}商品</span>
          {lowCount > 0 && (
            <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">在庫不足 {lowCount}</span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-navy tabular-nums">在庫金額 {yen(totalValue)}</span>
          <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
        </div>
      </button>
      {open && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground">
              <tr className="border-b">
                <th className="px-3 py-2 text-left">商品名</th>
                <th className="px-3 py-2 text-left">カテゴリ</th>
                <th className="px-3 py-2 text-right">在庫</th>
                <th className="px-3 py-2 text-right">最小</th>
                <th className="px-3 py-2 text-right">通常(税抜/税込)</th>
                <th className="px-3 py-2 text-right">卸(税抜/税込)</th>
                <th className="px-3 py-2 text-right">在庫金額</th>
              </tr>
            </thead>
            <tbody>
              {group.rows.map((r) => (
                <tr key={r.productId} className={cn("border-b last:border-0", r.low && "bg-red-50")}>
                  <td className="px-3 py-2 font-medium">
                    {r.name}
                    {r.size && <span className="ml-1 rounded bg-navy/10 px-1.5 py-0.5 text-xs text-navy">{r.size}</span>}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{r.category ?? "-"}</td>
                  <td className={cn("px-3 py-2 text-right font-semibold tabular-nums", r.low ? "text-red-600" : "text-navy")}>
                    {r.stock} {r.unit}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{r.minStock}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{yen(r.normalExcl)} / {yen(r.normalIncl)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{yen(r.wholesaleExcl)} / {yen(r.wholesaleIncl)}</td>
                  <td className="px-3 py-2 text-right font-medium tabular-nums">{yen(r.stockValueWholesale)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
