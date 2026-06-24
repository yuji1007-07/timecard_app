import { signOut } from "@/auth";
import { LogOut } from "lucide-react";

export function LogoutButton() {
  return (
    <form
      action={async () => {
        "use server";
        await signOut({ redirectTo: "/login" });
      }}
    >
      <button
        type="submit"
        className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-white/80 transition-colors hover:bg-white/10 hover:text-white"
      >
        <LogOut className="h-4 w-4" />
        ログアウト
      </button>
    </form>
  );
}
