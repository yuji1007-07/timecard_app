"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Store,
  Package,
  Tags,
  ArrowLeftRight,
  ClipboardCheck,
  PlusCircle,
  Users,
  Settings,
  KeyRound,
  Boxes,
  Printer,
} from "lucide-react";
import { cn } from "@/lib/utils";

const ICONS = {
  dashboard: LayoutDashboard,
  store: Store,
  product: Package,
  brand: Tags,
  inventory: Boxes,
  transaction: ArrowLeftRight,
  stocktake: ClipboardCheck,
  newtx: PlusCircle,
  users: Users,
  settings: Settings,
  account: KeyRound,
  print: Printer,
} as const;

export type NavItem = { href: string; label: string; icon: keyof typeof ICONS };

export function SidebarNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-1">
      {items.map((item) => {
        const Icon = ICONS[item.icon];
        const active =
          pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
              active
                ? "bg-white/15 font-medium text-white"
                : "text-white/70 hover:bg-white/10 hover:text-white"
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
