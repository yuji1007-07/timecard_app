/**
 * 旧システム（Render 上の Flask 版 API: moushikomi_api.py）の PostgreSQL から、新システムへデータを移行する。
 *
 * 使い方:
 *   OLD_DATABASE_URL="postgresql://...(RenderのExternal Database URL)" npm run migrate:from-render
 *
 * - 旧テーブル moushikomi_templates / moushikomi_applications（JSON を data 列に丸ごと保存）を読み取る
 * - テンプレート: 旧IDをそのまま新IDとして取り込む（同じIDがあれば更新）
 * - 申込書: 旧IDをそのまま新IDとして取り込む。店舗名 → 店舗マスタを名前で照合し、
 *   見つからない店舗は「無効」状態で自動作成する（履歴を失わないため）
 * - 旧「本部設定」ドキュメント(__hq_settings__)の「店舗編集許可」フラグも引き継ぐ
 *   （本部のID/パスワードは引き継がない。新システムでは「スタッフ管理」「本部設定」で変更）
 * - 何度実行しても安全（既にあるものは更新、無いものは追加。削除はしない）
 */
import { PrismaClient } from "@prisma/client";
import { Client } from "pg";
import { SETTING_ALLOW_STORE_EDIT } from "../src/lib/constants";
import {
  normalizeChecks,
  normalizeFieldValues,
  normalizeFields,
  normalizePlans,
  normalizeStringArray,
} from "../src/lib/types";

const OLD_URL = process.env.OLD_DATABASE_URL;
if (!OLD_URL) {
  console.error("OLD_DATABASE_URL（旧 Render PostgreSQL の接続文字列）を設定してください。");
  process.exit(1);
}

const prisma = new PrismaClient();
const old = new Client({ connectionString: OLD_URL, ssl: OLD_URL.includes("localhost") ? undefined : { rejectUnauthorized: false } });

type OldRow = { id: string; data: string | Record<string, unknown> };
const SETTINGS_ID = "__hq_settings__";

function parseData(row: OldRow): Record<string, unknown> | null {
  try {
    const d = typeof row.data === "string" ? JSON.parse(row.data) : row.data;
    return d && typeof d === "object" ? (d as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}
const str = (v: unknown, fallback = ""): string => (v === null || v === undefined ? fallback : String(v));
function parseDate(v: unknown): Date | undefined {
  if (!v) return undefined;
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? undefined : d;
}

async function main() {
  await old.connect();
  console.log("旧DBに接続しました。");

  // ---- テンプレート（＋本部設定ドキュメント） ----
  const tplRows = (await old.query<OldRow>("SELECT id, data FROM moushikomi_templates ORDER BY updated_at")).rows;
  let tplCount = 0;
  let order = await prisma.template.count();
  for (const row of tplRows) {
    const d = parseData(row);
    if (!d) continue;
    if (row.id === SETTINGS_ID || d.kind === "settings") {
      const allow = !!d.allowStoreEdit;
      await prisma.setting.upsert({
        where: { key: SETTING_ALLOW_STORE_EDIT },
        create: { key: SETTING_ALLOW_STORE_EDIT, value: allow ? "1" : "0" },
        update: { value: allow ? "1" : "0" },
      });
      console.log(`本部設定: 店舗編集許可 = ${allow ? "ON" : "OFF"}`);
      continue;
    }
    const data = {
      name: str(d.name, "（無題）"),
      category: str(d.category),
      departments: normalizeStringArray(d.departments),
      bodyText: str(d.bodyText),
      fields: normalizeFields(d.fields),
      checks: normalizeChecks(d.checks),
      plans: normalizePlans(d.plans),
      terms: str(d.terms),
    };
    const createdAt = parseDate(d.createdAt);
    const exists = await prisma.template.findUnique({ where: { id: row.id } });
    if (exists) {
      await prisma.template.update({ where: { id: row.id }, data });
    } else {
      order += 1;
      await prisma.template.create({ data: { id: row.id, ...data, sortOrder: order, ...(createdAt ? { createdAt } : {}) } });
    }
    tplCount += 1;
  }
  console.log(`テンプレート: ${tplCount} 件`);

  // ---- 店舗（名前で照合。無ければ無効状態で作成） ----
  const storeByName = new Map<string, { id: string; name: string; department: string }>();
  for (const s of await prisma.store.findMany()) storeByName.set(s.name, { id: s.id, name: s.name, department: s.department });
  let createdStores = 0;
  async function resolveStore(name: string, department: string) {
    const key = name.trim() || "（店舗未設定）";
    const hit = storeByName.get(key);
    if (hit) return hit;
    const count = await prisma.store.count();
    const row = await prisma.store.create({
      data: { name: key, department: department || "整骨院", pinCode: null, isActive: false, sortOrder: count + 1 },
    });
    const v = { id: row.id, name: row.name, department: row.department };
    storeByName.set(key, v);
    createdStores += 1;
    console.log(`  店舗マスタに無い店舗「${key}」を無効状態で作成しました。`);
    return v;
  }

  // ---- 申込書 ----
  const appRows = (await old.query<OldRow>("SELECT id, data FROM moushikomi_applications ORDER BY created_at")).rows;
  let appCount = 0;
  let skipped = 0;
  for (const row of appRows) {
    const d = parseData(row);
    if (!d) {
      skipped += 1;
      continue;
    }
    const store = await resolveStore(str(d.storeName), str(d.department));
    const data = {
      templateId: str(d.templateId),
      templateName: str(d.templateName, "（無題）"),
      category: str(d.category),
      bodySnapshot: str(d.bodySnapshot),
      termsSnapshot: str(d.termsSnapshot),
      checks: normalizeChecks(d.checks),
      fields: normalizeFields(d.fields),
      applyDate: str(d.applyDate).slice(0, 10),
      storeId: store.id,
      storeName: store.name,
      department: str(d.department) || store.department,
      staffName: str(d.staffName),
      fieldValues: normalizeFieldValues(d.fieldValues),
      planId: str(d.planId),
      planName: str(d.planName),
      monthlyFee: str(d.monthlyFee),
      initialFee: str(d.initialFee),
      checkedItems: normalizeStringArray(d.checkedItems),
      signatureDataUrl: str(d.signatureDataUrl),
    };
    const createdAt = parseDate(d.createdAt);
    await prisma.application.upsert({
      where: { id: row.id },
      create: { id: row.id, ...data, ...(createdAt ? { createdAt } : {}) },
      update: data,
    });
    appCount += 1;
  }
  console.log(`申込書: ${appCount} 件（スキップ ${skipped} 件、自動作成した店舗 ${createdStores} 件）`);
  console.log("✅ 移行完了");
}

main()
  .catch((e) => {
    console.error("❌ 移行に失敗しました:", e);
    process.exit(1);
  })
  .finally(async () => {
    await old.end().catch(() => {});
    await prisma.$disconnect();
  });
