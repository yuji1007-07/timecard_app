import { auth } from "@/auth";
import { redirect } from "next/navigation";

export type SessionUser = {
  id: string;
  name?: string | null;
  email?: string | null;
  role: string;
  storeId: string | null;
  departmentId: string | null;
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

export function isAreaManager(user: SessionUser | null): boolean {
  return user?.role === "AREA_MANAGER";
}

/** ユーザーが閲覧可能な店舗IDの絞り込み条件を返す。エリアマネージャーは全店舗(null)。 */
export function scopeStoreFilter(user: SessionUser): { storeId?: string } {
  if (user.role === "AREA_MANAGER") return {};
  return { storeId: user.storeId ?? "__none__" };
}
