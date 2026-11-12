"use server";

import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { POSITIONS } from "@/lib/constants";
import { matchStore, normalizeText } from "@/lib/stores";

const positionKeys = Object.keys(POSITIONS) as [keyof typeof POSITIONS, ...(keyof typeof POSITIONS)[]];

const createSchema = z.object({
  name: z.string().trim().min(1, "氏名は必須です"),
  loginId: z.string().trim().min(1, "ユーザーIDは必須です"),
  password: z.string().min(4, "初期パスワードは4文字以上にしてください"),
  role: z.enum(["ADMIN", "STAFF"]),
  position: z.enum(positionKeys),
  storeId: z.string().min(1, "店舗を選択してください"),
});

export async function createUser(_prev: unknown, formData: FormData) {
  await requireAdmin();
  const parsed = createSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  if (await prisma.user.findUnique({ where: { loginId: d.loginId } })) return { error: `ユーザーID「${d.loginId}」は既に使われています。` };
  if (!(await prisma.store.findUnique({ where: { id: d.storeId } }))) return { error: "店舗が見つかりません。" };
  await prisma.user.create({
    data: { name: d.name, loginId: d.loginId, passwordHash: await bcrypt.hash(d.password, 10), role: d.role, position: d.position, storeId: d.storeId },
  });
  return { success: true, message: `${d.name} さんを登録しました。` };
}

const updateSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1, "氏名は必須です"),
  loginId: z.string().trim().min(1, "ユーザーIDは必須です"),
  password: z.string(),
  role: z.enum(["ADMIN", "STAFF"]),
  position: z.enum(positionKeys),
  storeId: z.string().min(1, "店舗を選択してください"),
  isActive: z.enum(["1", "0"]),
});

export async function updateUser(_prev: unknown, formData: FormData) {
  const me = await requireAdmin();
  const parsed = updateSchema.safeParse({ password: "", ...Object.fromEntries(formData) });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  const target = await prisma.user.findUnique({ where: { id: d.id } });
  if (!target) return { error: "スタッフが見つかりません。" };
  const dup = await prisma.user.findUnique({ where: { loginId: d.loginId } });
  if (dup && dup.id !== d.id) return { error: `ユーザーID「${d.loginId}」は既に使われています。` };
  if (d.password && d.password.length < 4) return { error: "パスワードは4文字以上にしてください。" };
  // 自分自身の権限を外したり無効にしたりして、本部が誰も入れなくなるのを防ぐ
  const isSelf = target.id === me.id;
  await prisma.user.update({
    where: { id: d.id },
    data: {
      name: d.name,
      loginId: d.loginId,
      role: isSelf ? target.role : d.role,
      position: d.position,
      storeId: d.storeId,
      isActive: isSelf ? true : d.isActive === "1",
      ...(d.password ? { passwordHash: await bcrypt.hash(d.password, 10) } : {}),
    },
  });
  return { success: true, message: "更新しました。" };
}

/** CSV 1行を分解（"" で囲んだ値とカンマ・タブ区切りに対応） */
function splitCsvLine(line: string): string[] {
  const sep = line.includes("\t") && !line.includes(",") ? "\t" : ",";
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cur += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === sep) {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

const POSITION_BY_LABEL: Record<string, string> = {
  店長: "MANAGER",
  院長: "MANAGER",
  副店長: "SUBMANAGER",
  副院長: "SUBMANAGER",
  リーダー: "LEADER",
  スタッフ: "STAFF",
  一般: "STAFF",
  "": "STAFF",
};

export type BulkResult = { success: true; created: number; errors: string[] } | { error: string };

/**
 * スタッフの CSV 一括登録。
 * 列: 氏名, ユーザーID, 店舗名, 役職, 初期パスワード（1行目が見出しなら読み飛ばす）
 * 既にあるユーザーIDは上書きせずスキップする（既存データは変えない）。
 */
export async function bulkCreateUsers(_prev: unknown, formData: FormData): Promise<BulkResult> {
  await requireAdmin();
  const text = String(formData.get("bulkText") ?? "").replace(/^﻿/, "");
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return { error: "CSV の内容が空です。" };
  if (lines.length > 500) return { error: "一度に登録できるのは500行までです。" };

  const stores = await prisma.store.findMany({ where: { isActive: true } });
  const existing = new Set((await prisma.user.findMany({ select: { loginId: true } })).map((u) => u.loginId));
  const errors: string[] = [];
  let created = 0;

  for (let i = 0; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i]);
    if (i === 0 && (cols[0] === "氏名" || /ユーザーID/i.test(cols[1] ?? ""))) continue; // 見出し行
    const no = i + 1;
    const [nameRaw, loginIdRaw, storeRaw, positionRaw, password] = [cols[0] ?? "", cols[1] ?? "", cols[2] ?? "", cols[3] ?? "", cols[4] ?? ""];
    const name = normalizeText(nameRaw);
    const loginId = loginIdRaw.normalize("NFKC").trim();
    if (!name || !loginId) {
      errors.push(`${no}行目: 氏名とユーザーIDは必須です。`);
      continue;
    }
    if (existing.has(loginId)) {
      errors.push(`${no}行目: ユーザーID「${loginId}」は登録済みのためスキップしました。`);
      continue;
    }
    const store = matchStore(stores, storeRaw);
    if (!store) {
      errors.push(`${no}行目（${name}）: 店舗名「${storeRaw}」が店舗マスタに見つかりません。`);
      continue;
    }
    const position = POSITION_BY_LABEL[normalizeText(positionRaw)];
    if (!position) {
      errors.push(`${no}行目（${name}）: 役職「${positionRaw}」は 店長／副店長／リーダー／スタッフ のいずれかにしてください。`);
      continue;
    }
    if (password.length < 4) {
      errors.push(`${no}行目（${name}）: 初期パスワードは4文字以上にしてください。`);
      continue;
    }
    await prisma.user.create({
      data: { name, loginId, passwordHash: await bcrypt.hash(password, 10), role: "STAFF", position, storeId: store.id },
    });
    existing.add(loginId);
    created += 1;
  }
  return { success: true, created, errors };
}
