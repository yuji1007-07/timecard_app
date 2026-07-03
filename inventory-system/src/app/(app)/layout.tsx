import Link from "next/link";
import { requireUser } from "@/lib/session";
import { SidebarNav, type NavItem } from "@/components/sidebar-nav";
import { LogoutButton } from "@/components/logout-button";
import { MobileMenu } from "@/components/mobile-menu";
import { ROLES, label } from "@/lib/constants";

const AREA_NAV: NavItem[] = [
  { href: "/dashboard", label: "本部ダッシュボード", icon: "dashboard" },
  { href: "/inventory", label: "在庫一覧", icon: "inventory" },
  { href: "/transactions", label: "取引履歴", icon: "transaction" },
  { href: "/stocktake", label: "棚卸", icon: "stocktake" },
  { href: "/stores", label: "店舗管理", icon: "store" },
  { href: "/products", label: "商品マスタ", icon: "product" },
  { href: "/brands", label: "ブランド・カテゴリ", icon: "brand" },
  { href: "/users", label: "ユーザー管理", icon: "users" },
  { href: "/backup", label: "PDFバックアップ", icon: "print" },
  { href: "/settings", label: "通知・連携設定", icon: "settings" },
  { href: "/account", label: "アカウント設定", icon: "account" },
];

const STAFF_NAV: NavItem[] = [
  { href: "/dashboard", label: "店舗ダッシュボード", icon: "dashboard" },
  { href: "/inventory", label: "在庫一覧", icon: "inventory" },
  { href: "/transactions/new", label: "取引を記録", icon: "newtx" },
  { href: "/transactions", label: "取引履歴", icon: "transaction" },
  { href: "/stocktake", label: "棚卸", icon: "stocktake" },
  { href: "/account", label: "アカウント設定", icon: "account" },
];

// 店舗マネージャー: スタッフの機能＋商品マスタ・ブランド設定（店舗/ユーザー/通知設定は不可）
const MANAGER_NAV: NavItem[] = [
  { href: "/dashboard", label: "店舗ダッシュボード", icon: "dashboard" },
  { href: "/inventory", label: "在庫一覧", icon: "inventory" },
  { href: "/transactions/new", label: "取引を記録", icon: "newtx" },
  { href: "/transactions", label: "取引履歴", icon: "transaction" },
  { href: "/stocktake", label: "棚卸", icon: "stocktake" },
  { href: "/products", label: "商品マスタ", icon: "product" },
  { href: "/brands", label: "ブランド・カテゴリ", icon: "brand" },
  { href: "/account", label: "アカウント設定", icon: "account" },
];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const nav =
    user.role === "AREA_MANAGER" ? AREA_NAV : user.role === "STORE_MANAGER" ? MANAGER_NAV : STAFF_NAV;

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col bg-navy px-3 py-5 text-white md:flex">
        <Link href="/dashboard" className="mb-6 px-2">
          <div className="text-lg font-bold leading-tight">まごころ在庫</div>
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

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="relative flex items-center justify-between border-b bg-card px-4 py-3 md:hidden">
          <Link href="/dashboard" className="font-bold text-navy">
            まごころ在庫
          </Link>
          <MobileMenu items={nav} userName={user.name ?? ""} roleName={label(ROLES, user.role)} />
        </header>
        <main className="flex-1 overflow-x-hidden bg-background p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
