"use client";

import { useActionState, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/confirm-submit";
import { TX_TYPES, yen } from "@/lib/constants";
import { exclFromIncl } from "@/lib/pricing";
import { createTransaction } from "../actions";

type ProductOpt = {
  id: string;
  brandId: string;
  name: string;
  brandName: string;
  taxRate: number;
  unit: string;
  normalIncl: number;
  wholesaleIncl: number;
};
type StoreOpt = { id: string; name: string };

// 入力フォームに出す取引種別（移動は1つにまとめる）
const FORM_TYPES: { key: string; label: string }[] = [
  { key: "ORDER", label: TX_TYPES.ORDER },
  { key: "CONSUME", label: TX_TYPES.CONSUME },
  { key: "TRANSFER", label: "店舗間移動" },
  { key: "EMPLOYEE_SALE", label: TX_TYPES.EMPLOYEE_SALE },
  { key: "GIFT", label: TX_TYPES.GIFT },
];

export function TransactionForm({
  products,
  stores,
  fixedStoreId,
  defaultType,
}: {
  products: ProductOpt[];
  stores: StoreOpt[];
  fixedStoreId: string | null;
  defaultType?: string;
}) {
  const router = useRouter();
  const [type, setType] = useState(defaultType ?? "ORDER");
  const [storeId, setStoreId] = useState(fixedStoreId ?? stores[0]?.id ?? "");
  const [productId, setProductId] = useState("");
  const [brandId, setBrandId] = useState(""); // 大項目（ブランド）で絞り込み
  const [q, setQ] = useState(""); // 商品名キーワードで絞り込み
  const [price, setPrice] = useState<number | "">("");
  const [result, action] = useActionState(createTransaction, undefined);

  const product = useMemo(() => products.find((p) => p.id === productId), [products, productId]);
  const today = new Date().toISOString().slice(0, 10);

  // ブランド一覧（商品から重複なしで導出）
  const brands = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of products) if (!m.has(p.brandId)) m.set(p.brandId, p.brandName);
    return Array.from(m, ([id, name]) => ({ id, name }));
  }, [products]);

  // ブランド × キーワードで絞り込んだ商品
  const filtered = useMemo(() => {
    let list = brandId ? products.filter((p) => p.brandId === brandId) : products;
    const kw = q.trim();
    if (kw) list = list.filter((p) => p.name.includes(kw));
    return list;
  }, [products, brandId, q]);

  function onSelectBrand(bid: string) {
    setBrandId(bid);
    setProductId("");
    setPrice("");
  }

  if (result === "OK") {
    router.push("/transactions");
    router.refresh();
  }

  // 商品選択時に価格の初期値をセット
  function onSelectProduct(pid: string) {
    setProductId(pid);
    const p = products.find((x) => x.id === pid);
    if (!p) return;
    if (type === "CONSUME") setPrice(p.normalIncl || "");
    else if (type === "EMPLOYEE_SALE") setPrice(p.wholesaleIncl || "");
  }

  function onSelectType(t: string) {
    setType(t);
    if (product) {
      if (t === "CONSUME") setPrice(product.normalIncl || "");
      else if (t === "EMPLOYEE_SALE") setPrice(product.wholesaleIncl || "");
      else setPrice("");
    }
  }

  const showPrice = type === "CONSUME" || type === "EMPLOYEE_SALE";
  const exclPreview = showPrice && price && product ? exclFromIncl(Number(price), product.taxRate) : null;
  const sel = "h-10 w-full rounded-md border border-input bg-background px-3 text-sm";

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="type" value={type} />

      {/* 取引種別 */}
      <div className="flex flex-wrap gap-2">
        {FORM_TYPES.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => onSelectType(t.key)}
            className={
              "rounded-full border px-4 py-1.5 text-sm transition-colors " +
              (type === t.key ? "border-navy bg-navy text-white" : "bg-card hover:bg-secondary")
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="grid gap-4 rounded-lg border bg-card p-4 md:grid-cols-2">
        {/* 店舗 */}
        <div className="space-y-1">
          <Label>{type === "TRANSFER" ? "移動元店舗" : "店舗"}</Label>
          {fixedStoreId ? (
            <>
              <input type="hidden" name="storeId" value={storeId} />
              <div className={sel + " flex items-center bg-muted"}>{stores.find((s) => s.id === storeId)?.name}</div>
            </>
          ) : (
            <select name="storeId" value={storeId} onChange={(e) => setStoreId(e.target.value)} className={sel}>
              {stores.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          )}
        </div>

        {type === "TRANSFER" && (
          <div className="space-y-1">
            <Label>移動先店舗</Label>
            <select name="toStoreId" className={sel} required defaultValue="">
              <option value="">選択してください</option>
              {stores.filter((s) => s.id !== storeId).map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* 商品：ブランド（大項目）で絞り込み → 商品。キーワードでもさらに絞れる */}
        <div className="space-y-1">
          <Label>ブランド（大項目）</Label>
          <select value={brandId} onChange={(e) => onSelectBrand(e.target.value)} className={sel}>
            <option value="">すべてのブランド</option>
            {brands.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label>商品名で絞り込み（任意）</Label>
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="キーワードを入力" />
        </div>
        <div className="space-y-1 md:col-span-2">
          <Label>商品（{filtered.length}件）</Label>
          <select name="productId" value={productId} onChange={(e) => onSelectProduct(e.target.value)} className={sel} required>
            <option value="">選択してください</option>
            {filtered.map((p) => (
              <option key={p.id} value={p.id}>
                {brandId ? "" : `[${p.brandName}] `}
                {p.name}（{p.taxRate}%）
              </option>
            ))}
          </select>
        </div>

        {/* 数量 */}
        <div className="space-y-1">
          <Label>数量{product ? `（${product.unit}）` : ""}</Label>
          <Input name="quantity" type="number" min={1} defaultValue={1} required />
        </div>

        {/* 日付 */}
        <div className="space-y-1">
          <Label>{type === "ORDER" ? "発注・入荷日" : "日付"}</Label>
          <Input name="date" type="date" defaultValue={today} />
        </div>

        {/* 価格 */}
        {showPrice && (
          <div className="space-y-1">
            <Label>{type === "EMPLOYEE_SALE" ? "社販価格（税込・卸ベース）" : "販売価格（税込）"}</Label>
            <Input name="unitPriceIncl" type="number" value={price} onChange={(e) => setPrice(e.target.value === "" ? "" : Number(e.target.value))} />
            {exclPreview != null && <p className="text-xs text-muted-foreground">税抜: {yen(exclPreview)}</p>}
          </div>
        )}

        {/* 種別ごとの追加項目 */}
        {type === "ORDER" && (
          <div className="space-y-1">
            <Label>仕入先</Label>
            <Input name="supplier" />
          </div>
        )}
        {type === "EMPLOYEE_SALE" && (
          <div className="space-y-1">
            <Label>対象者</Label>
            <Input name="counterpart" placeholder="社販対象のスタッフ名" />
          </div>
        )}
        {type === "GIFT" && (
          <>
            <div className="space-y-1">
              <Label>渡した相手</Label>
              <Input name="counterpart" />
            </div>
            <div className="space-y-1">
              <Label>理由</Label>
              <Input name="reason" />
            </div>
          </>
        )}

        {/* 担当者・メモ */}
        <div className="space-y-1">
          <Label>担当者</Label>
          <Input name="assignee" />
        </div>
        <div className="space-y-1 md:col-span-2">
          <Label>メモ</Label>
          <Input name="memo" />
        </div>
      </div>

      {result && result !== "OK" && <p className="text-sm text-destructive">{result}</p>}
      <div className="flex gap-2">
        <SubmitButton>記録する</SubmitButton>
        <Button type="button" variant="ghost" onClick={() => router.push("/transactions")}>キャンセル</Button>
      </div>
    </form>
  );
}
