import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { SETTING_ALLOW_STORE_EDIT } from "@/lib/constants";

export type SessionUser = {
  id: string;
  name?: string | null;
  email?: string | null; // ログインID
  role: string;
  storeId: string | null;
};

/** 画面で使う「ログイン中ユーザー」情報（所属店舗を含む） */
export type CurrentUser = SessionUser & {
  isAdmin: boolean;
  /** 店舗担当なら所属店舗。本部は null（=全店舗） */
  storeId: string | null;
  storeName: string | null;
  storeDepartment: string | null;
};

export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await auth();
  if (!session?.user) return null;
  return session.user as SessionUser;
}

export async function requireUser(): Promise<CurrentUser> {
  const su = await getSessionUser();
  if (!su) redirect("/login");

  const dbUser = await prisma.user.findUnique({ where: { id: su.id }, include: { store: true } });
  if (!dbUser || !dbUser.isActive) redirect("/login");

  const isAdmin = dbUser.role === "ADMIN";
  return {
    id: dbUser.id,
    name: dbUser.name,
    email: dbUser.loginId,
    role: dbUser.role,
    isAdmin,
    storeId: isAdmin ? null : dbUser.storeId,
    storeName: isAdmin ? null : (dbUser.store?.name ?? null),
    storeDepartment: isAdmin ? null : (dbUser.store?.department ?? null),
  };
}

/** 本部のみ */
export async function requireAdmin(): Promise<CurrentUser> {
  const user = await requireUser();
  if (!user.isAdmin) redirect("/home");
  return user;
}

/** 本部が「店舗アカウントにテンプレート編集を許可する」をオンにしているか */
export async function getAllowStoreEdit(): Promise<boolean> {
  const row = await prisma.setting.findUnique({ where: { key: SETTING_ALLOW_STORE_EDIT } });
  return row?.value === "1";
}

/** テンプレート編集ができるか（本部、または本部が店舗編集を許可している場合） */
export async function canEditTemplates(user: CurrentUser): Promise<boolean> {
  if (user.isAdmin) return true;
  return getAllowStoreEdit();
}

/** テンプレート管理画面に入れる人（本部 or 編集許可された店舗） */
export async function requireTemplateEditor(): Promise<CurrentUser> {
  const user = await requireUser();
  if (!(await canEditTemplates(user))) redirect("/home");
  return user;
}

/** 店舗担当が見てよい申込書の絞り込み条件（本部は全店） */
export function applicationScope(user: CurrentUser): { storeId?: string } {
  if (user.isAdmin) return {};
  return { storeId: user.storeId ?? "__none__" };
}
