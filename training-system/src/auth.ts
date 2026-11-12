import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { authConfig } from "@/auth.config";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        loginId: { label: "ユーザーID", type: "text" },
        password: { label: "パスワード", type: "password" },
      },
      async authorize(credentials) {
        const parsed = z
          .object({ loginId: z.string().min(1), password: z.string().min(1) })
          .safeParse(credentials);
        if (!parsed.success) return null;

        const loginId = parsed.data.loginId.trim();
        const user = await prisma.user.findUnique({ where: { loginId } });
        if (!user || !user.isActive) return null;

        const ok = await bcrypt.compare(parsed.data.password, user.passwordHash);
        if (!ok) return null;

        return {
          id: user.id,
          email: user.loginId,
          name: user.name,
          role: user.role,
          storeId: user.storeId,
        };
      },
    }),
  ],
});
