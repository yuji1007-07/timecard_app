import Link from "next/link";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { SidebarNav, type NavItem } from "@/components/sidebar-nav";
import { LogoutButton } from "@/components/logout-button";
import { MobileMenu } from "@/components/mobile-menu";
import { APP_NAME, COMPANY_NAME, POSITIONS, ROLES, label } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();

  let nav: NavItem[];
  if (user.isAdmin) {
    const unanswered = await prisma.inquiry.count({ where: { answeredAt: null } });
    nav = [
      { href: "/dashboard", label: "研修動画", icon: "video" },
      { href: "/admin/progress", label: "進捗表", icon: "progress" },
      { href: "/admin/incomplete", label: "必修の未完了者", icon: "alert" },
      { href: "/admin/quiz-stats", label: "テストの正答率", icon: "quiz" },
      { href: "/admin/reflections", label: "ふりかえり一覧", icon: "reflection" },
      { href: "/admin/inquiries", label: "質問箱", icon: "inbox", badge: unanswered },
      { href: "/admin/videos", label: "動画・テスト管理", icon: "manage" },
      { href: "/admin/users", label: "スタッフ管理", icon: "users" },
      { href: "/account", label: "アカウント設定", icon: "account" },
    ];
  } else {
    nav = [
      { href: "/dashboard", label: "研修動画", icon: "video" },
      ...(user.isStoreManager ? [{ href: "/store-progress", label: "自店舗の進捗", icon: "progress" } as NavItem] : []),
      { href: "/account", label: "アカウント設定", icon: "account" },
    ];
  }
  const role = user.isAdmin ? ROLES.ADMIN : label(POSITIONS, user.position);
  const sub = user.storeName ? `${user.storeName} / ${role}` : role;

  return (
    <div className="flex min-h-screen">
      {/* サイドバー（PC） */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col bg-navy px-3 py-5 text-white md:flex">
        <Link href="/dashboard" prefetch={false} className="mb-6 px-2">
          <div className="text-lg font-bold leading-tight">{APP_NAME}</div>
          <div className="text-xs text-white/60">{COMPANY_NAME}</div>
        </Link>
        <nav className="flex-1 overflow-y-auto">
          <SidebarNav items={nav} />
        </nav>
        <div className="mt-3 border-t border-white/10 pt-3">
          <div className="px-3 pb-2">
            <div className="text-sm font-medium">{user.name}</div>
            <div className="text-xs text-white/50">{sub}</div>
          </div>
          <LogoutButton />
        </div>
      </aside>

      {/* モバイル用トップバー */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b bg-card px-4 py-3 md:hidden">
          <Link href="/dashboard" prefetch={false} className="font-bold text-navy">
            {APP_NAME}
          </Link>
          <MobileMenu items={nav} userName={user.name ?? ""} roleName={sub} />
        </header>
        <main className="flex-1 overflow-x-hidden bg-background p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
