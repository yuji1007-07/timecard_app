import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/stat-card";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { BusinessTypeBadge } from "@/components/badges";
import { yen } from "@/lib/constants";

export const dynamic = "force-dynamic";

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// 直近12ヶ月の選択肢
function monthOptions(): string[] {
  const out: string[] = [];
  const d = new Date();
  for (let i = 0; i < 12; i++) {
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    d.setMonth(d.getMonth() - 1);
  }
  return out;
}

export default async function StocktakePage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const month = sp.month || currentMonth();
  const isArea = user.role === "AREA_MANAGER";

  const stores = await prisma.store.findMany({
    where: { isHeadquarters: false, status: "ACTIVE", ...(isArea ? {} : { id: user.storeId ?? "__none__" }) },
    orderBy: { sortOrder: "asc" },
  });

  const stocktakes = await prisma.stocktake.findMany({ where: { targetMonth: month } });
  const stMap = new Map(stocktakes.map((s) => [s.storeId, s]));

  const doneCount = stores.filter((s) => stMap.has(s.id)).length;
  const notDone = stores.length - doneCount;
  const totalDiffAmount = stores.reduce((sum, s) => sum + (stMap.get(s.id)?.diffAmount ?? 0), 0);

  return (
    <div>
      <PageHeader title="棚卸" description="月末に各店舗で棚卸を行い、理論在庫と実在庫のズレを記録します。" />

      <form method="GET" className="mb-4 flex items-end gap-2 rounded-lg border bg-card p-3">
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          対象月
          <select name="month" defaultValue={month} className="h-9 rounded-md border border-input bg-background px-2 text-sm">
            {monthOptions().map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </label>
        <button type="submit" className="h-9 rounded-md bg-navy px-4 text-sm text-white">表示</button>
      </form>

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="対象店舗" value={`${stores.length}`} />
        <StatCard label="棚卸済" value={`${doneCount}`} tone="good" />
        <StatCard label="未実施" value={`${notDone}`} tone={notDone > 0 ? "bad" : "good"} />
        <StatCard label="ズレ総額" value={yen(totalDiffAmount)} tone={totalDiffAmount !== 0 ? "warn" : "default"} />
      </div>

      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-secondary/60 text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left">店舗</th>
              <th className="px-3 py-2 text-left">業態</th>
              <th className="px-3 py-2 text-center">状態</th>
              <th className="px-3 py-2 text-right">ズレ件数</th>
              <th className="px-3 py-2 text-right">ズレ金額</th>
              <th className="px-3 py-2 text-right">操作</th>
            </tr>
          </thead>
          <tbody>
            {stores.map((s) => {
              const st = stMap.get(s.id);
              const done = !!st;
              return (
                <tr key={s.id} className={`border-t ${done ? "" : "bg-red-50"}`}>
                  <td className="px-3 py-2 font-medium">{s.name}</td>
                  <td className="px-3 py-2"><BusinessTypeBadge type={s.businessType} /></td>
                  <td className="px-3 py-2 text-center">
                    {done ? (
                      <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">棚卸済</span>
                    ) : (
                      <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">未実施</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{st ? st.diffCount : "-"}</td>
                  <td className={`px-3 py-2 text-right tabular-nums ${st && st.diffAmount !== 0 ? "text-red-600" : ""}`}>{st ? yen(st.diffAmount) : "-"}</td>
                  <td className="px-3 py-2 text-right">
                    <Button asChild size="sm" variant={done ? "outline" : "default"}>
                      <Link href={`/stocktake/${s.id}?month=${month}`}>{done ? "再入力" : "棚卸する"}</Link>
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
