import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import { requireAreaManager } from "@/lib/session";
import { BusinessTypeBadge, StoreStatusBadge } from "@/components/badges";
import { StoreForm } from "./store-form";
import { deleteStore } from "./actions";
import { ConfirmSubmit } from "@/components/confirm-submit";

export const dynamic = "force-dynamic";

export default async function StoresPage() {
  await requireAreaManager();
  const stores = await prisma.store.findMany({ orderBy: { sortOrder: "asc" } });

  return (
    <div>
      <PageHeader
        title="店舗管理"
        description="21拠点＋本部。業態区分・本部フラグ・店舗PINを設定できます。"
        action={<StoreForm />}
      />
      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-secondary/60 text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left">店舗名</th>
              <th className="px-3 py-2 text-left">業態</th>
              <th className="px-3 py-2 text-left">責任者</th>
              <th className="px-3 py-2 text-left">PIN</th>
              <th className="px-3 py-2 text-left">状態</th>
              <th className="px-3 py-2 text-right">操作</th>
            </tr>
          </thead>
          <tbody>
            {stores.map((s) => (
              <tr key={s.id} className="border-t">
                <td className="px-3 py-2">
                  <Link href={`/stores/${s.id}`} className="font-medium text-navy hover:underline">
                    {s.name}
                  </Link>
                  {s.isHeadquarters && <span className="ml-2 rounded bg-navy px-1.5 py-0.5 text-[10px] text-white">本部</span>}
                </td>
                <td className="px-3 py-2"><BusinessTypeBadge type={s.businessType} /></td>
                <td className="px-3 py-2 text-muted-foreground">{s.directorName ?? "-"}</td>
                <td className="px-3 py-2 tabular-nums text-muted-foreground">{s.pinCode ?? "-"}</td>
                <td className="px-3 py-2"><StoreStatusBadge status={s.status} /></td>
                <td className="px-3 py-2">
                  <div className="flex justify-end gap-2">
                    <StoreForm store={s} />
                    <form action={deleteStore}>
                      <input type="hidden" name="id" value={s.id} />
                      <ConfirmSubmit message={`「${s.name}」を削除しますか？（取引履歴がある場合は閉院扱いになります）`}>
                        削除
                      </ConfirmSubmit>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
