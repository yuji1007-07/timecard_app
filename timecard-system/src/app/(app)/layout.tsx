import Link from "next/link";
import { requireUser } from "@/lib/session";
import { SidebarNav, type NavItem } from "@/components/sidebar-nav";
import { LogoutButton } from "@/components/logout-button";
import { MobileMenu } from "@/components/mobile-menu";
import { APP_NAME, COMPANY_NAME, roleLabel } from "@/lib/constants";

const STAFF_NAV: NavItem[] = [
  { href: "/dashboard", label: "打刻", icon: "dashboard" },
  { href: "/account", label: "アカウント設定", icon: "account" },
];

const MANAGER_NAV: NavItem[] = [
  { href: "/dashboard", label: "打刻", icon: "dashboard" },
  { href: "/attendance", label: "勤怠管理", icon: "report" },
  { href: "/attendance/bulk", label: "打刻一括編集", icon: "kdi" },
  { href: "/account", label: "アカウント設定", icon: "account" },
];

const ADMIN_NAV: NavItem[] = [
  { href: "/dashboard", label: "打刻", icon: "dashboard" },
  { href: "/attendance", label: "勤怠管理", icon: "report" },
  { href: "/attendance/bulk", label: "打刻一括編集", icon: "kdi" },
  { href: "/users", label: "スタッフ管理", icon: "users" },
  { href: "/stores", label: "店舗管理", icon: "store" },
  { href: "/account", label: "アカウント設定", icon: "account" },
];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const nav = user.isAdmin ? ADMIN_NAV : user.isManager ? MANAGER_NAV : STAFF_NAV;
  const role = roleLabel(user.role, user.isManager);
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
        <header className="relative flex items-center justify-between border-b bg-card px-4 py-3 md:hidden">
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
