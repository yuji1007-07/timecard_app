import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

export type SessionUser = {
  id: string;
  name?: string | null;
  email?: string | null; // ログインID
  role: string;
  storeId: string | null;
};

/** 画面で使う「ログイン中ユーザー」情報（担当店舗を含む） */
export type CurrentUser = SessionUser & {
  /** 全体管理者なら null（=全店舗）。それ以外は担当店舗ID（主所属店舗を含む） */
  managedStoreIds: string[] | null;
  isAdmin: boolean;
  isManager: boolean;
  storeName: string | null;
  storeBrand: string | null;
};

export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await auth();
  if (!session?.user) return null;
  return session.user as SessionUser;
}

/** 担当店舗ID一覧（主所属店舗を含む）。担当が1件も無ければ空配列 */
export async function getManagedStoreIds(userId: string, primaryStoreId: string | null): Promise<string[]> {
  const rows = await prisma.storePermission.findMany({ where: { userId }, select: { storeId: true } });
  if (rows.length === 0) return [];
  const ids = new Set(rows.map((r) => r.storeId));
  if (primaryStoreId) ids.add(primaryStoreId);
  return [...ids];
}

export async function requireUser(): Promise<CurrentUser> {
  const su = await getSessionUser();
  if (!su) redirect("/login");

  const dbUser = await prisma.user.findUnique({ where: { id: su.id }, include: { store: true } });
  if (!dbUser || !dbUser.isActive) redirect("/login");

  const isAdmin = dbUser.role === "ADMIN";
  const managed = isAdmin ? null : await getManagedStoreIds(dbUser.id, dbUser.storeId);

  return {
    id: dbUser.id,
    name: dbUser.name,
    email: dbUser.loginId,
    role: dbUser.role,
    storeId: dbUser.storeId,
    managedStoreIds: managed,
    isAdmin,
    isManager: isAdmin || (managed !== null && managed.length > 0),
    storeName: dbUser.store?.name ?? null,
    storeBrand: dbUser.store?.brand ?? null,
  };
}

/** 全体管理者のみ */
export async function requireAdmin(): Promise<CurrentUser> {
  const user = await requireUser();
  if (!user.isAdmin) redirect("/dashboard");
  return user;
}

/** 店舗責任者以上（全体管理者 or 担当店舗を1件以上持つスタッフ） */
export async function requireManager(): Promise<CurrentUser> {
  const user = await requireUser();
  if (!user.isManager) redirect("/dashboard");
  return user;
}

/** そのユーザーが店舗のデータを閲覧・編集できるか */
export function canAccessStore(user: CurrentUser, storeId: string): boolean {
  if (user.managedStoreIds === null) return true;
  return user.managedStoreIds.includes(storeId);
}
