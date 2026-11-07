// テンプレート・申込書の読み出し（ログイン中ユーザーの権限で絞り込む）
import { prisma } from "@/lib/prisma";
import type { CurrentUser } from "@/lib/session";
import {
  toApplicationData,
  toApplicationListItem,
  toTemplateData,
  visibleForDept,
  type ApplicationData,
  type ApplicationListItem,
  type TemplateData,
} from "@/lib/types";

/** テンプレート一覧。店舗担当は自部門のテンプレートだけ（本部は全部） */
export async function listTemplatesFor(user: CurrentUser): Promise<TemplateData[]> {
  const rows = await prisma.template.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] });
  const all = rows.map(toTemplateData);
  if (user.isAdmin) return all;
  const dept = user.storeDepartment ?? "";
  return all.filter((t) => visibleForDept(t, dept));
}

/** テンプレート1件。店舗担当が自部門以外を開こうとしたら null */
export async function getTemplateFor(user: CurrentUser, id: string): Promise<TemplateData | null> {
  const row = await prisma.template.findUnique({ where: { id } });
  if (!row) return null;
  const t = toTemplateData(row);
  if (!user.isAdmin && !visibleForDept(t, user.storeDepartment ?? "")) return null;
  return t;
}

const LIST_SELECT = {
  id: true,
  templateId: true,
  templateName: true,
  category: true,
  fields: true,
  applyDate: true,
  storeId: true,
  storeName: true,
  department: true,
  staffName: true,
  fieldValues: true,
  planId: true,
  planName: true,
  monthlyFee: true,
  initialFee: true,
  checkedItems: true,
  createdAt: true,
} as const;

/** 申込書一覧（軽量版・新しい順）。店舗担当は自店のデータだけ */
export async function listApplicationsFor(user: CurrentUser): Promise<ApplicationListItem[]> {
  const rows = await prisma.application.findMany({
    where: user.isAdmin ? {} : { storeId: user.storeId ?? "__none__" },
    orderBy: { createdAt: "desc" },
    select: LIST_SELECT,
  });
  return rows.map(toApplicationListItem);
}

/** 申込書1件（署名画像込み）。店舗担当が他店のものを開こうとしたら null */
export async function getApplicationFor(user: CurrentUser, id: string): Promise<ApplicationData | null> {
  const row = await prisma.application.findUnique({ where: { id } });
  if (!row) return null;
  if (!user.isAdmin && row.storeId !== user.storeId) return null;
  return toApplicationData(row);
}

/** 複数件（バックアップ用・署名画像込み）。権限外のものは除外 */
export async function getApplicationsFor(user: CurrentUser, ids: string[]): Promise<ApplicationData[]> {
  if (ids.length === 0) return [];
  const rows = await prisma.application.findMany({
    where: { id: { in: ids }, ...(user.isAdmin ? {} : { storeId: user.storeId ?? "__none__" }) },
  });
  const byId = new Map(rows.map((r) => [r.id, toApplicationData(r)]));
  return ids.map((id) => byId.get(id)).filter((x): x is ApplicationData => !!x);
}
