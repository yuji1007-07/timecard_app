"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireTemplateEditor } from "@/lib/session";
import { KARADA_TEMPLATES } from "@/lib/karada-templates";
import { DEPARTMENTS } from "@/lib/constants";
import { newId, normalizeChecks, normalizeFields, normalizePlans, normalizeStringArray, type TemplateData } from "@/lib/types";

type Result = { ok: boolean; message: string };

const templateSchema = z.object({
  id: z.string().optional(),
  name: z.string(),
  category: z.string().default(""),
  departments: z.unknown(),
  bodyText: z.string().default(""),
  fields: z.unknown(),
  checks: z.unknown(),
  plans: z.unknown(),
  terms: z.string().default(""),
});

/** テンプレートの保存（新規 / 更新）。編集画面の model を JSON で受け取る */
export async function saveTemplate(_prev: unknown, formData: FormData): Promise<Result & { id?: string }> {
  await requireTemplateEditor();
  let raw: unknown;
  try {
    raw = JSON.parse(String(formData.get("json") ?? ""));
  } catch {
    return { ok: false, message: "保存データが読み取れませんでした。" };
  }
  const parsed = templateSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, message: "保存データの形式が正しくありません。" };
  const d = parsed.data;
  const name = d.name.trim();
  if (!name) return { ok: false, message: "テンプレート名は必須です。" };

  const data = {
    name,
    category: d.category.trim(),
    departments: normalizeStringArray(d.departments).filter((x) => (DEPARTMENTS as readonly string[]).includes(x)),
    bodyText: d.bodyText,
    fields: normalizeFields(d.fields),
    checks: normalizeChecks(d.checks),
    plans: normalizePlans(d.plans),
    terms: d.terms,
  };

  const existing = d.id ? await prisma.template.findUnique({ where: { id: d.id } }) : null;
  if (existing) {
    await prisma.template.update({ where: { id: existing.id }, data });
    return { ok: true, message: "保存しました。", id: existing.id };
  }
  const count = await prisma.template.count();
  const row = await prisma.template.create({ data: { ...data, sortOrder: count + 1 } });
  return { ok: true, message: "保存しました。", id: row.id };
}

/** 複製（名前に「（コピー）」を付け、項目IDは振り直す） */
export async function duplicateTemplate(_prev: unknown, formData: FormData): Promise<Result> {
  await requireTemplateEditor();
  const id = String(formData.get("id") ?? "");
  const original = await prisma.template.findUnique({ where: { id } });
  if (!original) return { ok: false, message: "テンプレートが見つかりません。" };
  const count = await prisma.template.count();
  await prisma.template.create({
    data: {
      name: original.name + "（コピー）",
      category: original.category,
      departments: normalizeStringArray(original.departments),
      bodyText: original.bodyText,
      fields: normalizeFields(original.fields).map((f) => ({ ...f, id: newId() })),
      checks: normalizeChecks(original.checks).map((c) => ({ ...c, id: newId() })),
      plans: normalizePlans(original.plans).map((p) => ({ ...p, id: newId() })),
      terms: original.terms,
      sortOrder: count + 1,
    },
  });
  return { ok: true, message: "複製しました。" };
}

export async function deleteTemplate(_prev: unknown, formData: FormData): Promise<Result> {
  await requireTemplateEditor();
  const id = String(formData.get("id") ?? "");
  const row = await prisma.template.findUnique({ where: { id } });
  if (!row) return { ok: false, message: "テンプレートが見つかりません。" };
  await prisma.template.delete({ where: { id } });
  return { ok: true, message: "削除しました。" };
}

/**
 * からだラボ標準テンプレートを読み込む
 * （未登録のものは追加し、すでにある同名の標準テンプレートは最新の正式な契約文に更新する）
 */
export async function loadKaradaTemplates(): Promise<Result> {
  await requireTemplateEditor();
  const existing = await prisma.template.findMany();
  const byName = new Map(existing.map((t) => [t.name, t]));
  let added = 0;
  let updated = 0;
  let count = existing.length;
  for (const t of KARADA_TEMPLATES()) {
    const data = {
      name: t.name,
      category: t.category,
      departments: t.departments,
      bodyText: t.bodyText,
      fields: t.fields,
      checks: t.checks,
      plans: t.plans,
      terms: t.terms,
    };
    const ex = byName.get(t.name);
    if (ex) {
      // 既存の標準を最新の内容へ上書き（idと作成日は引き継ぐ）
      await prisma.template.update({ where: { id: ex.id }, data });
      updated++;
    } else {
      count++;
      await prisma.template.create({ data: { ...data, sortOrder: count } });
      added++;
    }
  }
  const msg: string[] = [];
  if (added > 0) msg.push(`${added}件を追加`);
  if (updated > 0) msg.push(`${updated}件を最新の契約文に更新`);
  return { ok: true, message: msg.length ? msg.join("／") + "しました。" : "変更はありませんでした。" };
}

/** 編集用に1件取得（存在しなければ null） */
export async function getTemplateForEdit(id: string): Promise<TemplateData | null> {
  await requireTemplateEditor();
  const row = await prisma.template.findUnique({ where: { id } });
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    departments: normalizeStringArray(row.departments),
    bodyText: row.bodyText,
    fields: normalizeFields(row.fields),
    checks: normalizeChecks(row.checks),
    plans: normalizePlans(row.plans),
    terms: row.terms,
  };
}
