"use server";

// 署名後の申込書保存（旧アプリ storage.saveApplication に相当）
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { isSignatureDataUrl } from "@/lib/paper";
import { normalizeChecks, normalizeFieldValues, normalizeFields, normalizeStringArray } from "@/lib/types";

const schema = z.object({
  templateId: z.string().min(1),
  templateName: z.string().min(1, "テンプレート名がありません。"),
  category: z.string().default(""),
  bodySnapshot: z.string().default(""),
  termsSnapshot: z.string().default(""),
  checks: z.unknown(),
  fields: z.unknown(),
  applyDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "申込日と店舗名は必須です。"),
  storeId: z.string().min(1, "申込日と店舗名は必須です。"),
  staffName: z.string().default(""),
  fieldValues: z.unknown(),
  planId: z.string().default(""),
  planName: z.string().default(""),
  monthlyFee: z.string().default(""),
  initialFee: z.string().default(""),
  checkedItems: z.unknown(),
  signatureDataUrl: z.string().min(1, "サインを記入してください。"),
});

export type SaveState = { ok: true; id: string } | { ok: false; message: string } | null;

export async function saveApplication(_prev: SaveState, formData: FormData): Promise<SaveState> {
  const me = await requireUser();
  let raw: unknown;
  try {
    raw = JSON.parse(String(formData.get("json") ?? ""));
  } catch {
    return { ok: false, message: "入力データが読み取れませんでした。最初からやり直してください。" };
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };
  const d = parsed.data;

  if (!isSignatureDataUrl(d.signatureDataUrl)) return { ok: false, message: "サインを記入してください。" };
  if (d.signatureDataUrl.length > 2_000_000) return { ok: false, message: "サイン画像が大きすぎます。やり直してください。" };

  // 店舗担当は自店にしか保存できない（店舗IDをサーバー側で強制）
  const storeId = me.isAdmin ? d.storeId : (me.storeId ?? "");
  const store = await prisma.store.findUnique({ where: { id: storeId } });
  if (!store) return { ok: false, message: "店舗が見つかりません。" };

  const fields = normalizeFields(d.fields);
  const checks = normalizeChecks(d.checks);
  const fieldValues = normalizeFieldValues(d.fieldValues);
  const checkedItems = normalizeStringArray(d.checkedItems);

  // 必須項目・全チェックはサーバー側でも確認
  for (const f of fields) {
    if (f.required && !(fieldValues[f.id] || "").trim()) return { ok: false, message: `「${f.label}」は必須項目です。` };
  }
  if (!checks.every((c) => checkedItems.includes(c.id))) return { ok: false, message: "すべての確認項目にチェックしてください。" };

  const row = await prisma.application.create({
    data: {
      templateId: d.templateId,
      templateName: d.templateName,
      category: d.category,
      bodySnapshot: d.bodySnapshot,
      termsSnapshot: d.termsSnapshot,
      checks,
      fields,
      applyDate: d.applyDate,
      storeId: store.id,
      storeName: store.name,
      department: store.department,
      staffName: d.staffName.trim(),
      fieldValues,
      planId: d.planId,
      planName: d.planName,
      monthlyFee: d.monthlyFee,
      initialFee: d.initialFee,
      checkedItems,
      signatureDataUrl: d.signatureDataUrl,
      createdById: me.id,
    },
  });
  return { ok: true, id: row.id };
}
