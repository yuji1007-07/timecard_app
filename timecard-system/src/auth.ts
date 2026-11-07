import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { authConfig } from "@/auth.config";
import { isLegacyHash, verifyLegacyPassword } from "@/lib/legacy-password";

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

        let ok = false;
        if (isLegacyHash(user.passwordHash)) {
          // 旧システムから移行したアカウント: 旧形式で照合し、成功したら bcrypt に更新
          ok = verifyLegacyPassword(parsed.data.password, user.passwordHash);
          if (ok) {
            await prisma.user
              .update({ where: { id: user.id }, data: { passwordHash: await bcrypt.hash(parsed.data.password, 10) } })
              .catch(() => {});
          }
        } else {
          ok = await bcrypt.compare(parsed.data.password, user.passwordHash);
        }
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
