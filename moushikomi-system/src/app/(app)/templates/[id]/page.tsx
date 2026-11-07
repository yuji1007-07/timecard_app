import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireTemplateEditor } from "@/lib/session";
import { newId, toTemplateData, type TemplateData } from "@/lib/types";
import { TemplateEditor } from "./template-editor";

export const dynamic = "force-dynamic";

export default async function TemplateEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireTemplateEditor();
  const isNew = id === "new";

  let model: TemplateData;
  if (isNew) {
    model = {
      id: "",
      name: "",
      category: "",
      departments: [],
      bodyText: "",
      fields: [{ id: newId(), label: "患者氏名", type: "text", required: true, placeholder: "" }],
      checks: [{ id: newId(), label: "上記の内容を確認しました" }],
      plans: [],
      terms: "",
    };
  } else {
    const row = await prisma.template.findUnique({ where: { id: decodeURIComponent(id) } });
    if (!row) {
      return (
        <div className="empty-box">
          <p>テンプレートが見つかりません。</p>
          <Link href="/templates" className="btn">
            一覧へ
          </Link>
        </div>
      );
    }
    model = toTemplateData(row);
  }

  return <TemplateEditor initial={model} isNew={isNew} />;
}
