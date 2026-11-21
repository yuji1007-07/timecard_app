import { requireAdmin } from "@/lib/session";
import { getProgressMatrix } from "@/lib/progress";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { IncompleteList } from "@/components/progress-table";
import { todayJst } from "@/lib/time";

export const dynamic = "force-dynamic";

export default async function AdminIncompletePage() {
  await requireAdmin();
  const matrix = await getProgressMatrix();
  return (
    <div>
      <PageHeader
        title="必修の未完了者"
        description="必修動画がまだ完了していないスタッフです（動画を見て、フィードバックを提出するまでを「完了」とします）。期限切れは赤で表示します。"
      />
      <Card>
        <CardContent className="pt-5">
          <IncompleteList matrix={matrix} showStoreTabs today={todayJst()} />
        </CardContent>
      </Card>
    </div>
  );
}
