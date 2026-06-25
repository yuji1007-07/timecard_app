import Link from "next/link";
import { requireUser } from "@/lib/session";
import { SidebarNav, type NavItem } from "@/components/sidebar-nav";
import { LogoutButton } from "@/components/logout-button";
import { MobileMenu } from "@/components/mobile-menu";
import { ROLES, label } from "@/lib/constants";

const AREA_NAV: NavItem[] = [
  { href: "/dashboard", label: "ダッシュボード", icon: "dashboard" },
  { href: "/stores", label: "店舗管理", icon: "store" },
  { href: "/reports", label: "報告一覧", icon: "report" },
  { href: "/kpi-templates", label: "KPIテンプレート", icon: "kpi" },
  { href: "/kdi-templates", label: "KDIテンプレート", icon: "kdi" },
  { href: "/alerts", label: "要注意条件", icon: "alert" },
  { href: "/users", label: "ユーザー管理", icon: "users" },
  { href: "/settings", label: "通知・連携設定", icon: "settings" },
  { href: "/account", label: "アカウント設定", icon: "account" },
];

const MANAGER_NAV: NavItem[] = [
  { href: "/dashboard", label: "ダッシュボード", icon: "dashboard" },
  { href: "/reports/new", label: "報告を作成", icon: "reportNew" },
  { href: "/reports", label: "過去報告", icon: "report" },
  { href: "/account", label: "アカウント設定", icon: "account" },
];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const nav = user.role === "AREA_MANAGER" ? AREA_NAV : MANAGER_NAV;

  return (
    <div className="flex min-h-screen">
      {/* サイドバー（PC） */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col bg-navy px-3 py-5 text-white md:flex">
        <Link href="/dashboard" className="mb-6 px-2">
          <div className="text-lg font-bold leading-tight">報告管理</div>
          <div className="text-xs text-white/60">整骨院・鍼灸・エステ</div>
        </Link>
        <nav className="flex-1 overflow-y-auto">
          <SidebarNav items={nav} />
        </nav>
        <div className="mt-3 border-t border-white/10 pt-3">
          <div className="px-3 pb-2">
            <div className="text-sm font-medium">{user.name}</div>
            <div className="text-xs text-white/50">{label(ROLES, user.role)}</div>
          </div>
          <LogoutButton />
        </div>
      </aside>

      {/* モバイル用トップバー */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="relative flex items-center justify-between border-b bg-card px-4 py-3 md:hidden">
          <Link href="/dashboard" className="font-bold text-navy">
            報告管理
          </Link>
          <MobileMenu items={nav} userName={user.name ?? ""} roleName={label(ROLES, user.role)} />
        </header>
        <main className="flex-1 overflow-x-hidden bg-background p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
