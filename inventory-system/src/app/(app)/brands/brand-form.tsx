"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/confirm-submit";
import { updateBrand } from "./actions";

export function BrandEditForm({ brand }: { brand: { id: string; name: string; colorHex: string; active: boolean } }) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return <Button variant="outline" size="sm" onClick={() => setOpen(true)}>編集</Button>;
  }
  return (
    <form
      action={async (fd) => {
        await updateBrand(brand.id, fd);
        setOpen(false);
      }}
      className="flex flex-wrap items-center gap-2"
    >
      <Input name="name" defaultValue={brand.name} className="h-8 w-40" />
      <input name="colorHex" type="color" defaultValue={brand.colorHex} className="h-8 w-10 rounded border" />
      <label className="flex items-center gap-1 text-xs">
        <input name="active" type="checkbox" defaultChecked={brand.active} /> 有効
      </label>
      <SubmitButton size="sm">保存</SubmitButton>
      <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>取消</Button>
    </form>
  );
}
