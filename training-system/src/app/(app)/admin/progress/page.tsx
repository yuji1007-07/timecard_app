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
        description="スタッフ×動画の視聴・テストの状況です。視聴回数（何回見たか）と最終視聴日も確認できます。対象外の動画は「対象外」と表示されます。"
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
