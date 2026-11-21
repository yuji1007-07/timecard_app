import { Download } from "lucide-react";
import { requireAdmin } from "@/lib/session";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { FeedbackList } from "@/components/feedback-list";
import { getFeedbackRows } from "@/lib/feedback";

export const dynamic = "force-dynamic";

export default async function FeedbackPage() {
  await requireAdmin();
  const rows = await getFeedbackRows();
  return (
    <div>
      <PageHeader
        title="フィードバック一覧"
        description="スタッフが動画の視聴後に書いた「感想」と「今後の実用法」です。新しい順に並びます。"
        action={
          <Button asChild variant="outline">
            <a href="/api/export/reflections" download>
              <Download />
              フィードバックCSV
            </a>
          </Button>
        }
      />
      <FeedbackList rows={rows} showStoreTabs />
    </div>
  );
}
