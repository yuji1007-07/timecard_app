import { Download } from "lucide-react";
import { requireAdmin } from "@/lib/session";
import { getProgressMatrix } from "@/lib/progress";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ProgressTable } from "@/components/progress-table";

export const dynamic = "force-dynamic";

export default async function AdminProgressPage() {
  await requireAdmin();
  const matrix = await getProgressMatrix();
  return (
    <div>
      <PageHeader
        title="進捗表"
        description="店舗ごとの完了人数をまとめて表示します。店舗名を押すと、スタッフごとの視聴・テストの状況（視聴回数・最終視聴日）が開きます。"
        action={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <a href="/api/export/progress" download>
                <Download />
                進捗表CSV
              </a>
            </Button>
            <Button asChild variant="outline">
              <a href="/api/export/quiz" download>
                <Download />
                テスト結果CSV
              </a>
            </Button>
          </div>
        }
      />
      <Card>
        <CardContent className="pt-5">
          <ProgressTable matrix={matrix} showStoreTabs />
        </CardContent>
      </Card>
    </div>
  );
}
