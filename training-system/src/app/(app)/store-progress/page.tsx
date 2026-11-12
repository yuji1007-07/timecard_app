import { Download } from "lucide-react";
import { requireStoreManager } from "@/lib/session";
import { getProgressMatrix } from "@/lib/progress";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { IncompleteList, ProgressTable } from "@/components/progress-table";
import { todayJst } from "@/lib/time";

export const dynamic = "force-dynamic";

/** 店長用：自分の店舗のスタッフの進捗だけを表示（店舗IDはサーバー側で固定。他店舗は見られない） */
export default async function StoreProgressPage() {
  const user = await requireStoreManager();
  const matrix = await getProgressMatrix({ storeId: user.storeId });
  return (
    <div>
      <PageHeader
        title="自店舗の進捗"
        description={`${user.storeName ?? ""} のスタッフの視聴・テストの状況です。未完了の方への声かけにお使いください。`}
        action={
          <Button asChild variant="outline">
            <a href="/api/export/progress" download>
              <Download />
              進捗表CSV
            </a>
          </Button>
        }
      />
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>必修の未完了者</CardTitle>
          </CardHeader>
          <CardContent>
            <IncompleteList matrix={matrix} showStoreTabs={false} today={todayJst()} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>進捗表</CardTitle>
          </CardHeader>
          <CardContent>
            <ProgressTable matrix={matrix} showStoreTabs={false} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
