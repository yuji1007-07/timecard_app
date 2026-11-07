import Link from "next/link";
import { canEditTemplates, requireUser } from "@/lib/session";
import { SidebarNav, type NavItem } from "@/components/sidebar-nav";
import { LogoutButton } from "@/components/logout-button";
import { MobileMenu } from "@/components/mobile-menu";
import { APP_NAME, COMPANY_NAME, roleLabel } from "@/lib/constants";

const COMMON_NAV: NavItem[] = [
  { href: "/home", label: "ホーム", icon: "home" },
  { href: "/select", label: "申込書を作成", icon: "create" },
  { href: "/history", label: "申込履歴", icon: "history" },
  { href: "/customers", label: "顧客管理", icon: "customers" },
];

const TEMPLATES_NAV: NavItem = { href: "/templates", label: "テンプレート管理", icon: "templates" };

const ADMIN_NAV: NavItem[] = [
  { href: "/stores", label: "店舗管理", icon: "store" },
  { href: "/users", label: "スタッフ管理", icon: "users" },
  { href: "/settings", label: "本部設定", icon: "settings" },
];

const ACCOUNT_NAV: NavItem = { href: "/account", label: "アカウント設定", icon: "account" };

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const editable = await canEditTemplates(user);

  const nav: NavItem[] = [
    ...COMMON_NAV,
    ...(editable ? [TEMPLATES_NAV] : []),
    ...(user.isAdmin ? ADMIN_NAV : []),
    ACCOUNT_NAV,
  ];
  const role = roleLabel(user.role);
  const sub = user.isAdmin ? "🏢 本部（全店）" : `🏥 ${user.storeDepartment ?? ""}／${user.storeName ?? ""}`;

  return (
    <div className="flex min-h-screen">
      {/* サイドバー（PC） */}
      <aside className="no-print sticky top-0 hidden h-screen w-60 shrink-0 flex-col bg-navy px-3 py-5 text-white md:flex">
        <Link href="/home" prefetch={false} className="mb-6 px-2">
          <div className="text-lg font-bold leading-tight">📋 {APP_NAME}</div>
          <div className="text-xs text-white/60">{COMPANY_NAME}</div>
        </Link>
        <nav className="flex-1 overflow-y-auto">
          <SidebarNav items={nav} />
        </nav>
        <div className="mt-3 border-t border-white/10 pt-3">
          <div className="px-3 pb-2">
            <div className="text-sm font-medium">{user.name}</div>
            <div className="text-xs text-white/50">{sub}</div>
            <div className="text-xs text-white/50">{role}</div>
          </div>
          <LogoutButton />
        </div>
      </aside>

      {/* モバイル用トップバー */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="no-print relative flex items-center justify-between border-b bg-card px-4 py-3 md:hidden">
          <Link href="/home" prefetch={false} className="font-bold text-navy">
            📋 {APP_NAME}
          </Link>
          <MobileMenu items={nav} userName={user.name ?? ""} roleName={sub} />
        </header>
        <main className="app-main flex-1 overflow-x-hidden bg-background p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
