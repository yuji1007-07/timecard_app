import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

export const { auth: middleware } = NextAuth(authConfig);

export const config = {
  // api / 静的アセット以外を保護対象にする
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
