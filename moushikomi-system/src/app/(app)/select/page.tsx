import Link from "next/link";
import { requireUser } from "@/lib/session";
import { listTemplatesFor } from "@/lib/data";
import { PageHeader } from "@/components/page-header";

export const dynamic = "force-dynamic";

export default async function SelectPage() {
  const user = await requireUser();
  const templates = await listTemplatesFor(user);
  const dept = user.storeDepartment ?? "";

  if (templates.length === 0) {
    return (
      <div>
        <PageHeader title="申込書を選択" />
        <div className="empty-box">
          <p>{dept ? `「${dept}」で使える申込書がまだ設定されていません。` : "テンプレートがまだありません。"}</p>
          <p className="muted mt-2">本部にお問い合わせください。（本部ログイン → テンプレート管理 → 各テンプレートの「対象部門」を設定）</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="申込書を選択" description="作成する申込書の種類を選んでください" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {templates.map((t) => (
          <Link
            key={t.id}
            href={`/form/${encodeURIComponent(t.id)}`}
            prefetch={false}
            className="flex flex-col gap-2 rounded-xl border bg-card p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-[#3d6fb4]"
          >
            <span className="self-start rounded-full bg-[#eaf1fb] px-3 py-1 text-sm font-bold text-[#3d6fb4]">{t.category || "申込書"}</span>
            <span className="text-xl font-bold text-navy">{t.name}</span>
            <span className="text-sm text-muted-foreground">
              入力項目 {t.fields.length}件 ・ プラン {(t.plans || []).length}件
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
