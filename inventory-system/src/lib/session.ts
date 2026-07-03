import { auth } from "@/auth";
import { redirect } from "next/navigation";

export type SessionUser = {
  id: string;
  name?: string | null;
  email?: string | null;
  role: string;
  storeId: string | null;
};

export async function getCurrentUser(): Promise<SessionUser | null> {
  const session = await auth();
  if (!session?.user) return null;
  return session.user as SessionUser;
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireAreaManager(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== "AREA_MANAGER") redirect("/dashboard");
  return user;
}

/** 商品・ブランド・カテゴリの設定ができる権限（本部 or 店舗マネージャー）。 */
export async function requireProductManager(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== "AREA_MANAGER" && user.role !== "STORE_MANAGER") redirect("/dashboard");
  return user;
}

export function isAreaManager(user: SessionUser | null): boolean {
  return user?.role === "AREA_MANAGER";
}

export function isProductManager(user: SessionUser | null): boolean {
  return user?.role === "AREA_MANAGER" || user?.role === "STORE_MANAGER";
}

/** 実在ユーザーIDのみ返す（PIN軽量モードの仮想ユーザー store:xxx は null）。 */
export function realUserId(user: SessionUser): string | null {
  return user.id.startsWith("store:") ? null : user.id;
}

/** 店舗スタッフが操作対象にできる店舗IDか検証。本部は全店OK。 */
export function canAccessStore(user: SessionUser, storeId: string): boolean {
  if (user.role === "AREA_MANAGER") return true;
  return user.storeId === storeId;
}
