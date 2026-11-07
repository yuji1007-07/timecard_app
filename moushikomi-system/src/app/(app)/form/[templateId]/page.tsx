import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { getTemplateFor } from "@/lib/data";
import { FormInput } from "./form-input";

export const dynamic = "force-dynamic";

export default async function FormPage({ params }: { params: Promise<{ templateId: string }> }) {
  const { templateId } = await params;
  const user = await requireUser();
  const template = await getTemplateFor(user, decodeURIComponent(templateId));

  if (!template) {
    return (
      <div className="empty-box">
        <p>テンプレートが見つかりません。</p>
        <Link href="/select" className="btn">
          選択画面へ戻る
        </Link>
      </div>
    );
  }

  // 店舗ログイン中は、その店舗に固定（店員さんは店舗を選べません）。本部は店舗を選ぶ。
  const stores = user.isAdmin
    ? (
        await prisma.store.findMany({ where: { isActive: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] })
      ).map((s) => ({ id: s.id, name: s.name, department: s.department }))
    : [];
  const lockedStore =
    !user.isAdmin && user.storeId ? { id: user.storeId, name: user.storeName ?? "", department: user.storeDepartment ?? "" } : null;

  return <FormInput template={template} stores={stores} lockedStore={lockedStore} />;
}
