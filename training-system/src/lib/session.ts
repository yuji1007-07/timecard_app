import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { LEADER_POSITIONS } from "@/lib/constants";

export type SessionUser = {
  id: string;
  name?: string | null;
  email?: string | null; // ログインID
  role: string;
  storeId: string | null;
};

/** 画面で使う「ログイン中ユーザー」情報 */
export type CurrentUser = SessionUser & {
  name: string;
  position: string;
  isAdmin: boolean;
  /** 責任者（店長・副店長・リーダー）か。責任者向け動画の対象判定に使う */
  isLeader: boolean;
  /** 店長（STAFF）で所属店舗がある人。自店舗の進捗だけ見られる */
  isStoreManager: boolean;
  storeName: string | null;
  storeBrand: string | null;
};

export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await auth();
  if (!session?.user) return null;
  return session.user as SessionUser;
}

/** セッションから DB の最新ユーザー情報を引く。未ログイン・無効なら null（API ルート用） */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const su = await getSessionUser();
  if (!su) return null;
  const dbUser = await prisma.user.findUnique({ where: { id: su.id }, include: { store: true } });
  if (!dbUser || !dbUser.isActive) return null;
  const isAdmin = dbUser.role === "ADMIN";
  return {
    id: dbUser.id,
    name: dbUser.name,
    email: dbUser.loginId,
    role: dbUser.role,
    position: dbUser.position,
    storeId: dbUser.storeId,
    isAdmin,
    isLeader: LEADER_POSITIONS.includes(dbUser.position),
    isStoreManager: !isAdmin && dbUser.position === "MANAGER" && !!dbUser.storeId,
    storeName: dbUser.store?.name ?? null,
    storeBrand: dbUser.store?.brand ?? null,
  };
}

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** 本部（ADMIN）のみ */
export async function requireAdmin(): Promise<CurrentUser> {
  const user = await requireUser();
  if (!user.isAdmin) redirect("/dashboard");
  return user;
}

/** 店長（自店舗の進捗を見られる人）。本部は /admin/progress を使う */
export async function requireStoreManager(): Promise<CurrentUser & { storeId: string }> {
  const user = await requireUser();
  if (!user.isStoreManager || !user.storeId) redirect("/dashboard");
  return user as CurrentUser & { storeId: string };
}
