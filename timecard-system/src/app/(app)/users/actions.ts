"use server";

import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { normalizeText } from "@/lib/stores";

const createSchema = z.object({
  name: z.string().min(1, "氏名は必須です"),
  loginId: z.string().min(1, "ユーザーIDは必須です"),
  password: z.string().min(4, "初期パスワードは4文字以上にしてください"),
  role: z.enum(["ADMIN", "STAFF"]),
  storeId: z.string().min(1, "主所属店舗を選択してください"),
});

export async function createUser(_prev: unknown, formData: FormData) {
  await requireAdmin();
  const parsed = createSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  const permissionStoreIds = formData.getAll("permissionStoreIds").map(String).filter(Boolean);

  const loginId = d.loginId.trim();
  const exists = await prisma.user.findUnique({ where: { loginId } });
  if (exists) return { error: `ユーザーID「${loginId}」は既に使われています。` };

  await prisma.user.create({
    data: {
      loginId,
      name: d.name.trim(),
      passwordHash: await bcrypt.hash(d.password, 10),
      role: d.role,
      storeId: d.storeId,
      permissions: d.role === "STAFF" ? { create: permissionStoreIds.map((storeId) => ({ storeId })) } : undefined,
    },
  });
  return { success: true };
}

const updateSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1, "氏名は必須です"),
  loginId: z.string().min(1, "ユーザーIDは必須です"),
  role: z.enum(["ADMIN", "STAFF"]),
  storeId: z.string().min(1, "主所属店舗を選択してください"),
  password: z.string().optional(),
  isActive: z.string().optional(),
});

export async function updateUser(_prev: unknown, formData: FormData) {
  const me = await requireAdmin();
  const parsed = updateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  const permissionStoreIds = formData.getAll("permissionStoreIds").map(String).filter(Boolean);

  const loginId = d.loginId.trim();
  const dup = await prisma.user.findUnique({ where: { loginId } });
  if (dup && dup.id !== d.id) return { error: `ユーザーID「${loginId}」は他のスタッフが使用しています。` };

  if (d.id === me.id && d.role !== "ADMIN") return { error: "自分自身の権限を全体管理者から変更することはできません。" };

  const data: {
    loginId: string;
    name: string;
    role: string;
    storeId: string;
    isActive: boolean;
    passwordHash?: string;
  } = {
    loginId,
    name: d.name.trim(),
    role: d.role,
    storeId: d.storeId,
    isActive: d.id === me.id ? true : d.isActive === "1",
  };
  if (d.password && d.password.trim() !== "") {
    if (d.password.length < 4) return { error: "パスワードは4文字以上にしてください。" };
    data.passwordHash = await bcrypt.hash(d.password, 10);
  }

  await prisma.$transaction([
    prisma.user.update({ where: { id: d.id }, data }),
    prisma.storePermission.deleteMany({ where: { userId: d.id } }),
    ...(d.role === "STAFF" && permissionStoreIds.length > 0
      ? [prisma.storePermission.createMany({ data: permissionStoreIds.map((storeId) => ({ userId: d.id, storeId })), skipDuplicates: true })]
      : []),
  ]);
  return { success: true };
}

export async function deleteUser(_prev: unknown, formData: FormData): Promise<{ ok: boolean; message: string }> {
  const me = await requireAdmin();
  const id = String(formData.get("id"));
  if (id === me.id) return { ok: false, message: "ログイン中の自分自身は削除できません。" };
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) return { ok: false, message: "対象スタッフが見つかりません。" };
  await prisma.user.delete({ where: { id } });
  return { ok: true, message: `${user.name}（${user.loginId}）を削除しました。` };
}

/**
 * 一括登録。1行1名: 氏名,ユーザーID,初期PW,主所属店舗,権限,担当店舗1|担当店舗2
 * 権限は省略で staff、担当店舗は省略可。店舗名は表示名で照合（全角半角のゆれは吸収）。
 */
export async function bulkCreateUsers(_prev: unknown, formData: FormData) {
  await requireAdmin();
  const raw = String(formData.get("bulkText") ?? "").replace(/\r\n?/g, "\n").trim();
  if (!raw) return { error: "登録するデータを入力してください。" };

  const stores = await prisma.store.findMany();
  const byName = new Map<string, string>();
  for (const s of stores) {
    byName.set(normalizeText(s.name), s.id);
    byName.set(normalizeText(s.shortName), s.id);
  }
  const resolve = (name: string) => byName.get(normalizeText(name)) ?? null;

  let created = 0;
  const errors: string[] = [];
  const lines = raw.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const lineNo = i + 1;
    const cols = lines[i].split(",").map((c) => normalizeText(c));
    if (cols.every((c) => !c)) continue;
    if (cols.length < 4) {
      errors.push(`${lineNo}行目: 項目数が足りません。『氏名,ユーザーID,初期PW,主所属店舗,権限,担当店舗1|担当店舗2』で入力してください。`);
      continue;
    }
    const [name, loginId, password, primaryStore] = cols;
    const roleRaw = (cols[4] || "staff").toLowerCase();
    const role = roleRaw === "admin" ? "ADMIN" : roleRaw === "staff" ? "STAFF" : null;
    if (!role) {
      errors.push(`${lineNo}行目: 権限は admin または staff のみ使えます。`);
      continue;
    }
    const storeId = resolve(primaryStore);
    if (!storeId) {
      errors.push(`${lineNo}行目: 主所属店舗『${primaryStore}』が見つかりません。`);
      continue;
    }
    const permissionIds: string[] = [];
    let bad = false;
    for (const pn of (cols[5] || "").split("|").map((x) => normalizeText(x)).filter(Boolean)) {
      const pid = resolve(pn);
      if (!pid) {
        errors.push(`${lineNo}行目: 担当店舗『${pn}』が見つかりません。`);
        bad = true;
        break;
      }
      permissionIds.push(pid);
    }
    if (bad) continue;
    if (!name || !loginId || !password) {
      errors.push(`${lineNo}行目: 氏名・ユーザーID・初期PWは必須です。`);
      continue;
    }
    const dup = await prisma.user.findUnique({ where: { loginId } });
    if (dup) {
      errors.push(`${lineNo}行目: ユーザーID『${loginId}』が重複しています。`);
      continue;
    }
    await prisma.user.create({
      data: {
        loginId,
        name,
        passwordHash: await bcrypt.hash(password, 10),
        role,
        storeId,
        permissions: role === "STAFF" && permissionIds.length ? { create: [...new Set(permissionIds)].map((sid) => ({ storeId: sid })) } : undefined,
      },
    });
    created += 1;
  }

  return { success: true, created, errors };
}
