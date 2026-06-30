"use client";

import { useState } from "react";
import { Menu, X, LogOut } from "lucide-react";
import { SidebarNav, type NavItem } from "@/components/sidebar-nav";
import { signOutAction } from "@/lib/auth-actions";

export function MobileMenu({
  items,
  userName,
  roleName,
}: {
  items: NavItem[];
  userName: string;
  roleName: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        aria-label="メニュー"
        onClick={() => setOpen((o) => !o)}
        className="rounded-md p-1.5 text-navy hover:bg-muted"
      >
        {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
      </button>

      {open && (
        <>
          {/* 背景クリックで閉じる */}
          <div className="fixed inset-0 top-[57px] z-40 bg-black/30" onClick={() => setOpen(false)} />
          <div
            className="absolute left-0 right-0 top-full z-50 max-h-[80vh] overflow-y-auto bg-navy p-3 text-white shadow-xl"
            onClick={() => setOpen(false)}
          >
            <SidebarNav items={items} />
            <div className="mt-3 border-t border-white/10 pt-3">
              <div className="px-3 pb-2">
                <div className="text-sm font-medium">{userName}</div>
                <div className="text-xs text-white/50">{roleName}</div>
              </div>
              <form action={signOutAction}>
                <button
                  type="submit"
                  className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-white/80 transition-colors hover:bg-white/10 hover:text-white"
                >
                  <LogOut className="h-4 w-4" />
                  ログアウト
                </button>
              </form>
            </div>
          </div>
        </>
      )}
    </>
  );
}
