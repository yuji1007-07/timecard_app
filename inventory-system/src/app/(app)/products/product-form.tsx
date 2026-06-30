"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/confirm-submit";
import { UNITS, TAX_RATES, PRICE_MODES } from "@/lib/constants";
import { inclFromExcl, exclFromIncl } from "@/lib/pricing";
import { createProduct, updateProduct } from "./actions";

type Brand = { id: string; name: string };
type Product = {
  id: string;
  brandId: string;
  name: string;
  category: string | null;
  size: string | null;
  color: string | null;
  taxRate: number;
  priceModeNormal: string;
  priceModeWholesale: string;
  normalPriceExcl: number;
  normalPriceIncl: number;
  wholesalePriceExcl: number;
  wholesalePriceIncl: number;
  unit: string;
  minStock: number;
  allStores: boolean;
  active: boolean;
};

function PricePair({
  prefix,
  mode,
  taxRate,
  excl,
  incl,
}: {
  prefix: string;
  mode: string;
  taxRate: number;
  excl: number;
  incl: number;
}) {
  const [e, setE] = useState(excl);
  const [i, setI] = useState(incl);

  function onExcl(v: number) {
    setE(v);
    if (mode === "EXCL") setI(v > 0 ? inclFromExcl(v, taxRate) : 0);
  }
  function onIncl(v: number) {
    setI(v);
    if (mode === "INCL") setE(v > 0 ? exclFromIncl(v, taxRate) : 0);
  }

  return (
    <div className="grid grid-cols-2 gap-2">
      <div className="space-y-1">
        <Label className="text-xs">税抜</Label>
        <Input
          name={`${prefix}Excl`}
          type="number"
          value={e || ""}
          onChange={(ev) => onExcl(Number(ev.target.value))}
          readOnly={mode === "INCL"}
          className={mode === "INCL" ? "bg-muted" : ""}
        />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">税込</Label>
        <Input
          name={`${prefix}Incl`}
          type="number"
          value={i || ""}
          onChange={(ev) => onIncl(Number(ev.target.value))}
          readOnly={mode === "EXCL"}
          className={mode === "EXCL" ? "bg-muted" : ""}
        />
      </div>
    </div>
  );
}

export function ProductForm({
  brands,
  categories,
  product,
}: {
  brands: Brand[];
  categories: string[];
  product?: Product;
}) {
  const [open, setOpen] = useState(false);
  const editing = !!product;
  const [taxRate, setTaxRate] = useState(product?.taxRate ?? 10);
  const [modeN, setModeN] = useState(product?.priceModeNormal ?? "BOTH");
  const [modeW, setModeW] = useState(product?.priceModeWholesale ?? "BOTH");

  if (!open) {
    return (
      <Button variant={editing ? "outline" : "default"} size="sm" onClick={() => setOpen(true)}>
        {editing ? "編集" : "＋ 商品を追加"}
      </Button>
    );
  }

  const action = editing
    ? updateProduct.bind(null, product!.id)
    : async (fd: FormData) => {
        await createProduct(fd);
      };

  return (
    <form
      action={async (fd) => {
        await action(fd);
        setOpen(false);
      }}
      className="grid gap-3 rounded-lg border bg-card p-4 md:grid-cols-2"
    >
      <div className="space-y-1">
        <Label>ブランド</Label>
        <select name="brandId" defaultValue={product?.brandId} required className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
          <option value="">選択</option>
          {brands.map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
      </div>
      <div className="space-y-1">
        <Label>商品名</Label>
        <Input name="name" defaultValue={product?.name} required />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label>サイズ（任意）</Label>
          <Input name="size" defaultValue={product?.size ?? ""} placeholder="S / M / L など" />
        </div>
        <div className="space-y-1">
          <Label>カラー（任意）</Label>
          <Input name="color" defaultValue={product?.color ?? ""} />
        </div>
      </div>
      <div className="space-y-1">
        <Label>カテゴリ</Label>
        <input name="category" defaultValue={product?.category ?? ""} list="cat-list" className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" />
        <datalist id="cat-list">
          {categories.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label>税率</Label>
          <select name="taxRate" value={taxRate} onChange={(e) => setTaxRate(Number(e.target.value))} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
            {TAX_RATES.map((r) => (
              <option key={r} value={r}>{r}%</option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label>単位</Label>
          <input name="unit" defaultValue={product?.unit ?? "個"} list="unit-list" className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" />
          <datalist id="unit-list">
            {UNITS.map((u) => (
              <option key={u} value={u} />
            ))}
          </datalist>
        </div>
      </div>

      <div className="space-y-2 rounded-md border p-3 md:col-span-1">
        <Label className="font-semibold">通常価格</Label>
        <select name="priceModeNormal" value={modeN} onChange={(e) => setModeN(e.target.value)} className="h-9 w-full rounded-md border border-input bg-background px-2 text-xs">
          {Object.entries(PRICE_MODES).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <PricePair prefix="normal" mode={modeN} taxRate={taxRate} excl={product?.normalPriceExcl ?? 0} incl={product?.normalPriceIncl ?? 0} />
      </div>

      <div className="space-y-2 rounded-md border p-3 md:col-span-1">
        <Label className="font-semibold">卸価格</Label>
        <select name="priceModeWholesale" value={modeW} onChange={(e) => setModeW(e.target.value)} className="h-9 w-full rounded-md border border-input bg-background px-2 text-xs">
          {Object.entries(PRICE_MODES).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <PricePair prefix="wholesale" mode={modeW} taxRate={taxRate} excl={product?.wholesalePriceExcl ?? 0} incl={product?.wholesalePriceIncl ?? 0} />
      </div>

      <div className="space-y-1">
        <Label>最小在庫数（下回るとアラート）</Label>
        <Input name="minStock" type="number" defaultValue={product?.minStock ?? 0} />
      </div>
      <div className="flex items-end gap-4">
        <label className="flex items-center gap-2 text-sm">
          <input name="allStores" type="checkbox" defaultChecked={product?.allStores ?? true} className="h-4 w-4" /> 全店共通
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input name="active" type="checkbox" value="on" defaultChecked={product?.active ?? true} className="h-4 w-4" /> 有効
        </label>
        <input type="hidden" name="active" value="off" />
      </div>

      <div className="flex gap-2 md:col-span-2">
        <SubmitButton>{editing ? "保存" : "追加"}</SubmitButton>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>キャンセル</Button>
      </div>
    </form>
  );
}
