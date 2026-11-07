import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { canEditTemplates, requireUser } from "@/lib/session";
import { listTemplatesFor } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const user = await requireUser();
  const [apps, templates, editable] = await Promise.all([
    prisma.application.count({ where: user.isAdmin ? {} : { storeId: user.storeId ?? "__none__" } }),
    listTemplatesFor(user),
    canEditTemplates(user),
  ]);

  return (
    <div>
      <section className="mb-7 rounded-[20px] bg-gradient-to-br from-navy to-[#3d6fb4] px-8 py-10 text-center text-white">
        <h1 className="text-3xl font-bold">会員入会申込書アプリ</h1>
        <p className="mt-2 text-lg opacity-90">iPadで申込書を表示・サイン・PDF印刷まで完結</p>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <HomeCard href="/select" icon="📝" title="新しい申込書を作成" desc="テンプレートを選んで入力を始めます" primary />
        <HomeCard href="/history" icon="📁" title="申込履歴" desc={`作成済み ${apps} 件 / 検索・PDF確認`} />
        <HomeCard href="/customers" icon="👥" title="顧客管理" desc="店舗別・カルテ番号順で一覧管理" />
        {editable && (
          <HomeCard href="/templates" icon="⚙️" title="テンプレート管理" desc={`登録 ${templates.length} 種類 / 作成・編集`} />
        )}
        {user.isAdmin && <HomeCard href="/settings" icon="🏢" title="本部設定" desc="本部ログインのID・パスワード変更" />}
      </div>

      <p className="mt-7 text-center text-sm text-muted-foreground">※ データは会社のサーバーに保存され、全iPad・PCで共有されます。</p>
    </div>
  );
}

function HomeCard({ href, icon, title, desc, primary }: { href: string; icon: string; title: string; desc: string; primary?: boolean }) {
  return (
    <Link
      href={href}
      prefetch={false}
      className={`block rounded-xl border px-6 py-7 text-center shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
        primary ? "border-[#c8dbf5] bg-[#eaf1fb]" : "bg-card"
      }`}
    >
      <div className="text-4xl">{icon}</div>
      <div className="mt-2 text-xl font-bold text-navy">{title}</div>
      <div className="mt-1 text-sm text-muted-foreground">{desc}</div>
    </Link>
  );
}
