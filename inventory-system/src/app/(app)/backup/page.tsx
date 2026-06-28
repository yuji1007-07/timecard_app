import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { prisma } from "@/lib/prisma";
import { requireAreaManager } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function BackupPage() {
  await requireAreaManager();
  const stores = await prisma.store.findMany({
    where: { isHeadquarters: false },
    select: { id: true, name: true },
    orderBy: { sortOrder: "asc" },
  });
  const sel = "h-10 w-full rounded-md border border-input bg-background px-3 text-sm";

  return (
    <div>
      <PageHeader
        title="PDFバックアップ"
        description="条件を指定して印刷用ページを開き、ブラウザの印刷（PDF保存）でローカルに保管できます。"
      />
      <Card className="max-w-2xl">
        <CardHeader><CardTitle className="text-base">バックアップ条件</CardTitle></CardHeader>
        <CardContent>
          {/* GETで /print に渡す */}
          <form method="GET" action="/print" target="_blank" className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1">
              <Label>種別</Label>
              <select name="type" className={sel} defaultValue="stocktake">
                <option value="stocktake">棚卸履歴</option>
                <option value="transaction">取引履歴</option>
                <option value="snapshot">在庫スナップショット</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label>店舗</Label>
              <select name="store" className={sel} defaultValue="">
                <option value="">全店舗</option>
                {stores.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label>期間の絞り方</Label>
              <select name="period" className={sel} defaultValue="month">
                <option value="month">月で選ぶ</option>
                <option value="year">年で選ぶ</option>
                <option value="range">期間指定</option>
                <option value="all">全期間</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label>対象月（月で選ぶ時）</Label>
              <Input name="month" type="month" />
            </div>
            <div className="space-y-1">
              <Label>対象年（年で選ぶ時）</Label>
              <Input name="year" type="number" placeholder="2026" />
            </div>
            <div className="grid grid-cols-2 gap-2 md:col-span-1">
              <div className="space-y-1">
                <Label>開始日</Label>
                <Input name="from" type="date" />
              </div>
              <div className="space-y-1">
                <Label>終了日</Label>
                <Input name="to" type="date" />
              </div>
            </div>
            <div className="md:col-span-2">
              <button type="submit" className="h-10 rounded-md bg-navy px-6 text-sm font-medium text-white">
                印刷用ページを開く
              </button>
              <p className="mt-2 text-xs text-muted-foreground">
                ※ 印刷用ページが新しいタブで開きます。ブラウザの「印刷 → PDFに保存」でバックアップしてください。店舗別・日付順に並び、店舗ごとに改ページされます。
              </p>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
