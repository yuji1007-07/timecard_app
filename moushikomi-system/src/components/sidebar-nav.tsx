"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  FilePlus2,
  FileText,
  Users,
  LayoutTemplate,
  Store,
  UserCog,
  Settings,
  KeyRound,
} from "lucide-react";
import { cn } from "@/lib/utils";

const ICONS = {
  home: Home,
  create: FilePlus2,
  history: FileText,
  customers: Users,
  templates: LayoutTemplate,
  store: Store,
  users: UserCog,
  settings: Settings,
  account: KeyRound,
} as const;

export type NavItem = { href: string; label: string; icon: keyof typeof ICONS };

/** 申込書作成フロー（/select /form /confirm /sign /print）は「申込書を作成」をアクティブ表示にする */
const CREATE_PREFIXES = ["/select", "/form", "/confirm", "/sign"];

export function SidebarNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-1">
      {items.map((item) => {
        const Icon = ICONS[item.icon];
        const active =
          pathname === item.href ||
          (item.href !== "/home" && pathname.startsWith(item.href)) ||
          (item.href === "/select" && CREATE_PREFIXES.some((p) => pathname.startsWith(p)));
        return (
          <Link
            key={item.href}
            href={item.href}
            prefetch={false}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
              active ? "bg-white/15 font-medium text-white" : "text-white/70 hover:bg-white/10 hover:text-white"
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
