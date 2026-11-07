import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireTemplateEditor } from "@/lib/session";
import { formatDateTime } from "@/lib/format";
import { toTemplateData } from "@/lib/types";
import { TemplateRowActions, LoadKaradaButton } from "./template-list";

export const dynamic = "force-dynamic";

export default async function TemplatesPage() {
  await requireTemplateEditor();
  const templates = (await prisma.template.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] })).map(toTemplateData);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-navy md:text-2xl">テンプレート管理</h1>
          <p className="mt-1 text-sm text-muted-foreground">申込書のひな形を作成・編集できます</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <LoadKaradaButton />
          <Link href="/templates/new" prefetch={false} className="btn btn--primary">
            ＋ 新規テンプレート
          </Link>
        </div>
      </div>

      {templates.length === 0 ? (
        <div className="empty-box">
          <p>テンプレートがありません。</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card shadow-sm">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-[#eaf1fb] text-navy">
              <tr>
                <th className="px-4 py-3 text-left font-medium">テンプレート名</th>
                <th className="px-4 py-3 text-left font-medium">種類</th>
                <th className="px-4 py-3 text-left font-medium">構成</th>
                <th className="px-4 py-3 text-left font-medium">最終更新</th>
                <th className="px-4 py-3 text-left font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {templates.map((t) => (
                <tr key={t.id} className="border-t align-middle hover:bg-muted/30">
                  <td className="px-4 py-3 font-bold">
                    {t.name}
                    <br />
                    <span className="dept-badge">{t.departments.length ? t.departments.join("・") : "全部門共通"}</span>
                  </td>
                  <td className="px-4 py-3">{t.category || ""}</td>
                  <td className="whitespace-nowrap px-4 py-3">
                    {t.fields.length}項目 / {t.plans.length}プラン
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">{formatDateTime(t.updatedAt)}</td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <TemplateRowActions id={t.id} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
