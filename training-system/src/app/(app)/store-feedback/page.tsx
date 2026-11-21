import { requireStoreManager } from "@/lib/session";
import { PageHeader } from "@/components/page-header";
import { FeedbackList } from "@/components/feedback-list";
import { getFeedbackRows } from "@/lib/feedback";

export const dynamic = "force-dynamic";

/** 店長用：自分の店舗のスタッフのフィードバックだけを表示（店舗IDはサーバー側で固定。他店舗は見られない） */
export default async function StoreFeedbackPage() {
  const user = await requireStoreManager();
  const rows = await getFeedbackRows({ storeId: user.storeId });
  return (
    <div>
      <PageHeader title="自店舗のフィードバック" description={`${user.storeName ?? ""} のスタッフが書いた「感想」と「今後の実用法」です。`} />
      <FeedbackList rows={rows} showStoreTabs={false} />
    </div>
  );
}
