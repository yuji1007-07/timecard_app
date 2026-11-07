// 旧システム（Render 上の Flask 版勤怠アプリ）の PostgreSQL から、新システムへデータを移行する共通処理。
// scripts/migrate-from-render.ts（ターミナル実行）と /api/migrate（ブラウザ実行）の両方から使う。
import type { PrismaClient } from "@prisma/client";
import { Client } from "pg";
import { detectBrandAndStore, normalizeText } from "./stores";

type OldStore = { id: number; brand_name: string; store_name: string; display_name: string; is_active: number };
type OldUser = { id: number; store_id: number; username: string; password_hash: string; full_name: string; role: string; is_active: number };
type OldPerm = { user_id: number; store_id: number };
type OldAttendance = {
  id: number;
  user_id: number;
  store_id: number;
  work_date: string;
  clock_in: string | null;
  break_start: string | null;
  break_end: string | null;
  clock_out: string | null;
  break_minutes: number | null;
  work_minutes: number | null;
  note: string | null;
};

/** 旧データの時刻文字列（ISO、タイムゾーン無しは日本時間扱い）を Date に */
function parseOld(value: string | null): Date | null {
  if (!value) return null;
  const v = value.trim().replace(" ", "T");
  const hasTz = /[+-]\d{2}:?\d{2}$|Z$/.test(v);
  const d = new Date(hasTz ? v : `${v}+09:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}


export type MigrateResult = { stores: number; users: number; permissions: number; attendance: number; skipped: number };

/**
 * 旧DBの店舗 / スタッフ / 担当店舗 / 打刻を新DBへコピーする。
 * - パスワードは旧ハッシュのまま取り込み、初回ログイン時に新形式へ自動更新される
 * - 何度実行しても安全（既にあるものは更新、無いものは追加。削除はしない）
 */
export async function migrateFromRender(prisma: PrismaClient, oldDatabaseUrl: string, log: (m: string) => void = () => {}): Promise<MigrateResult> {
  const old = new Client({ connectionString: oldDatabaseUrl, ssl: oldDatabaseUrl.includes("localhost") ? undefined : { rejectUnauthorized: false } });
  await old.connect();
  log("旧DBに接続しました。");
  try {
    // ---- 店舗 ----
    const stores = (await old.query<OldStore>("SELECT * FROM stores ORDER BY id")).rows;
    const storeMap = new Map<number, string>();
    let order = 0;
    for (const s of stores) {
      order += 1;
      const name = normalizeText(s.display_name);
      const { brand, shortName } = detectBrandAndStore(name);
      const row = await prisma.store.upsert({
        where: { name },
        create: { name, brand, shortName, isActive: !!s.is_active, sortOrder: order },
        update: { isActive: !!s.is_active },
      });
      storeMap.set(s.id, row.id);
    }
    log(`店舗: ${stores.length} 件`);

    // ---- スタッフ ----
    const users = (await old.query<OldUser>("SELECT * FROM users ORDER BY id")).rows;
    const userMap = new Map<number, string>();
    for (const u of users) {
      const storeId = storeMap.get(u.store_id) ?? null;
      const role = u.role === "admin" ? "ADMIN" : "STAFF";
      const row = await prisma.user.upsert({
        where: { loginId: u.username },
        create: { loginId: u.username, name: u.full_name, passwordHash: u.password_hash, role, storeId, isActive: !!u.is_active },
        update: { name: u.full_name, role, storeId, isActive: !!u.is_active },
      });
      userMap.set(u.id, row.id);
    }
    log(`スタッフ: ${users.length} 件`);

    // ---- 担当店舗 ----
    const perms = (await old.query<OldPerm>("SELECT user_id, store_id FROM user_store_permissions")).rows;
    let permCount = 0;
    for (const p of perms) {
      const userId = userMap.get(p.user_id);
      const storeId = storeMap.get(p.store_id);
      if (!userId || !storeId) continue;
      await prisma.storePermission.upsert({ where: { userId_storeId: { userId, storeId } }, create: { userId, storeId }, update: {} });
      permCount += 1;
    }
    log(`担当店舗: ${permCount} 件`);

    // ---- 打刻 ----
    const atts = (await old.query<OldAttendance>("SELECT * FROM attendance ORDER BY id")).rows;
    let attCount = 0;
    let skipped = 0;
    for (const a of atts) {
      const userId = userMap.get(a.user_id);
      const storeId = storeMap.get(a.store_id);
      if (!userId || !storeId) {
        skipped += 1;
        continue;
      }
      const workDate = String(a.work_date).slice(0, 10);
      const data = {
        storeId,
        clockIn: parseOld(a.clock_in),
        breakStart: parseOld(a.break_start),
        breakEnd: parseOld(a.break_end),
        clockOut: parseOld(a.clock_out),
        breakMinutes: a.break_minutes ?? 0,
        workMinutes: a.work_minutes ?? null,
        note: a.note || null,
      };
      await prisma.attendance.upsert({ where: { userId_workDate: { userId, workDate } }, create: { userId, workDate, ...data }, update: data });
      attCount += 1;
    }
    log(`打刻: ${attCount} 件（スキップ ${skipped} 件）`);
    return { stores: stores.length, users: users.length, permissions: permCount, attendance: attCount, skipped };
  } finally {
    await old.end().catch(() => {});
  }
}
