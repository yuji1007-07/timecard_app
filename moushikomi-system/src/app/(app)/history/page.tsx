import { requireUser } from "@/lib/session";
import { listApplicationsFor } from "@/lib/data";
import { PageHeader } from "@/components/page-header";
import { HistoryList } from "./history-list";

export const dynamic = "force-dynamic";

export default async function HistoryPage() {
  const user = await requireUser();
  // 店舗ログイン中は自店のデータだけ（本部は全店）
  const apps = await listApplicationsFor(user);

  return (
    <div>
      <PageHeader title="申込履歴" description="作成した申込書の一覧です" />
      <HistoryList apps={apps} />
    </div>
  );
}
