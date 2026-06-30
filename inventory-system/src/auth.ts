import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { authConfig } from "@/auth.config";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    // 本部・店舗スタッフ共通: メール＋パスワード
    Credentials({
      id: "credentials",
      credentials: {
        email: { label: "メールアドレス", type: "email" },
        password: { label: "パスワード", type: "password" },
      },
      async authorize(credentials) {
        const parsed = z
          .object({ email: z.string().email(), password: z.string().min(1) })
          .safeParse(credentials);
        if (!parsed.success) return null;

        const user = await prisma.user.findUnique({
          where: { email: parsed.data.email },
        });
        if (!user) return null;

        const ok = await bcrypt.compare(parsed.data.password, user.passwordHash);
        if (!ok) return null;

        return { id: user.id, email: user.email, name: user.name, role: user.role, storeId: user.storeId };
      },
    }),
    // 軽量モード: 店舗ID＋4桁PIN（店舗スタッフのみ。本部は使用不可）
    Credentials({
      id: "pin",
      credentials: {
        storeId: { label: "店舗", type: "text" },
        pin: { label: "PIN", type: "text" },
      },
      async authorize(credentials) {
        const parsed = z
          .object({ storeId: z.string().min(1), pin: z.string().min(4) })
          .safeParse(credentials);
        if (!parsed.success) return null;

        const store = await prisma.store.findUnique({ where: { id: parsed.data.storeId } });
        if (!store || store.isHeadquarters || !store.pinCode) return null;
        if (store.pinCode !== parsed.data.pin) return null;

        // 店舗共通アカウントとして振る舞う仮想ユーザー
        return {
          id: `store:${store.id}`,
          email: `${store.id}@store.local`,
          name: `${store.name}（店舗共通）`,
          role: "STORE_STAFF",
          storeId: store.id,
        };
      },
    }),
  ],
});
