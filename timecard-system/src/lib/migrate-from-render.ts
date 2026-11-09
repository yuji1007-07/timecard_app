// 旧システム（Render 上の Flask 版勤怠アプリ）の PostgreSQL から、新システムへデータを移行する共通処理。
// scripts/migrate-from-render.ts（ターミナル実行）と /api/migrate（ブラウザ実行）の両方から使う。
import type { Prisma, PrismaClient } from "@prisma/client";
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

export type OldExport = { stores: OldStore[]; users: OldUser[]; permissions: OldPerm[]; attendance: OldAttendance[] };

/** 旧DBへ直接接続して全データを読み出す */
export async function fetchFromOldDatabase(oldDatabaseUrl: string): Promise<OldExport> {
  const old = new Client({ connectionString: oldDatabaseUrl, ssl: oldDatabaseUrl.includes("localhost") ? undefined : { rejectUnauthorized: false } });
  await old.connect();
  try {
    return {
      stores: (await old.query<OldStore>("SELECT * FROM stores ORDER BY id")).rows,
      users: (await old.query<OldUser>("SELECT * FROM users ORDER BY id")).rows,
      permissions: (await old.query<OldPerm>("SELECT user_id, store_id FROM user_store_permissions")).rows,
      attendance: (await old.query<OldAttendance>("SELECT * FROM attendance ORDER BY id")).rows,
    };
  } finally {
    await old.end().catch(() => {});
  }
}

/** 旧アプリ（Flask版）の /api/export-all から全データを取得する（DBに直接繋がない方法） */
export async function fetchFromOldApp(baseUrl: string, username: string, password: string): Promise<OldExport> {
  const url = baseUrl.replace(/\/+$/, "") + "/api/export-all";
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
    cache: "no-store",
  });
  const text = await res.text();
  let json: { ok?: boolean; error?: string } & Partial<OldExport>;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`旧アプリの応答が不正です（HTTP ${res.status}）。URLが正しいか、旧アプリが最新版に更新されているか確認してください。`);
  }
  if (!res.ok || !json.ok) throw new Error(json.error || `旧アプリからの取得に失敗しました（HTTP ${res.status}）`);
  return { stores: json.stores ?? [], users: json.users ?? [], permissions: json.permissions ?? [], attendance: json.attendance ?? [] };
}

/**
 * 取得した旧データを新DBへ取り込む。
 * - パスワードは旧ハッシュのまま取り込み、初回ログイン時に新形式へ自動更新される
 * - 何度実行しても安全（既にあるものは更新、無いものは追加。削除はしない）
 */
export async function importOldData(prisma: PrismaClient, data: OldExport, log: (m: string) => void = () => {}): Promise<MigrateResult> {
  // ---- 店舗（件数が少ないので1件ずつ upsert）----
  const storeMap = new Map<number, string>();
  let order = 0;
  for (const s of data.stores) {
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
  log(`店舗: ${data.stores.length} 件`);

  // ---- スタッフ（既存はまとめて取得し、無いものだけ createMany）----
  const loginIds = data.users.map((u) => u.username);
  const existingUsers = await prisma.user.findMany({ where: { loginId: { in: loginIds } }, select: { id: true, loginId: true } });
  const existingByLogin = new Map(existingUsers.map((u) => [u.loginId, u.id]));
  const newUsers = data.users.filter((u) => !existingByLogin.has(u.username));
  if (newUsers.length > 0) {
    await prisma.user.createMany({
      data: newUsers.map((u) => ({
        loginId: u.username,
        name: u.full_name,
        passwordHash: u.password_hash,
        role: u.role === "admin" ? "ADMIN" : "STAFF",
        storeId: storeMap.get(u.store_id) ?? null,
        isActive: !!u.is_active,
      })),
      skipDuplicates: true,
    });
  }
  for (const u of data.users) {
    const id = existingByLogin.get(u.username);
    if (!id) continue;
    await prisma.user.update({
      where: { id },
      data: { name: u.full_name, role: u.role === "admin" ? "ADMIN" : "STAFF", storeId: storeMap.get(u.store_id) ?? null, isActive: !!u.is_active },
    });
  }
  const allUsers = await prisma.user.findMany({ where: { loginId: { in: loginIds } }, select: { id: true, loginId: true } });
  const idByLogin = new Map(allUsers.map((u) => [u.loginId, u.id]));
  const userMap = new Map<number, string>();
  for (const u of data.users) {
    const id = idByLogin.get(u.username);
    if (id) userMap.set(u.id, id);
  }
  log(`スタッフ: ${data.users.length} 件（新規 ${newUsers.length}）`);

  // ---- 担当店舗（createMany + skipDuplicates）----
  const permRows = data.permissions
    .map((p) => ({ userId: userMap.get(p.user_id), storeId: storeMap.get(p.store_id) }))
    .filter((p): p is { userId: string; storeId: string } => !!p.userId && !!p.storeId);
  if (permRows.length > 0) await prisma.storePermission.createMany({ data: permRows, skipDuplicates: true });
  log(`担当店舗: ${permRows.length} 件`);

  // ---- 打刻（既存キーをまとめて取得し、新規は createMany、既存は更新）----
  const userIds = [...new Set([...userMap.values()])];
  const existingAtt = await prisma.attendance.findMany({ where: { userId: { in: userIds } }, select: { id: true, userId: true, workDate: true } });
  const existingAttKey = new Map(existingAtt.map((a) => [`${a.userId}|${a.workDate}`, a.id]));
  const toCreate: Prisma.AttendanceCreateManyInput[] = [];
  const toUpdate: { id: string; data: Record<string, unknown> }[] = [];
  let skipped = 0;
  for (const a of data.attendance) {
    const userId = userMap.get(a.user_id);
    const storeId = storeMap.get(a.store_id);
    if (!userId || !storeId) {
      skipped += 1;
      continue;
    }
    const workDate = String(a.work_date).slice(0, 10);
    const row = {
      storeId,
      clockIn: parseOld(a.clock_in),
      breakStart: parseOld(a.break_start),
      breakEnd: parseOld(a.break_end),
      clockOut: parseOld(a.clock_out),
      breakMinutes: a.break_minutes ?? 0,
      workMinutes: a.work_minutes ?? null,
      note: a.note || null,
    };
    const existingId = existingAttKey.get(`${userId}|${workDate}`);
    if (existingId) toUpdate.push({ id: existingId, data: row });
    else toCreate.push({ userId, workDate, ...row });
  }
  for (let i = 0; i < toCreate.length; i += 500) {
    await prisma.attendance.createMany({ data: toCreate.slice(i, i + 500), skipDuplicates: true });
  }
  for (let i = 0; i < toUpdate.length; i += 50) {
    await prisma.$transaction(toUpdate.slice(i, i + 50).map((u) => prisma.attendance.update({ where: { id: u.id }, data: u.data })));
  }
  log(`打刻: ${toCreate.length + toUpdate.length} 件（新規 ${toCreate.length} / 更新 ${toUpdate.length} / スキップ ${skipped}）`);
  return { stores: data.stores.length, users: data.users.length, permissions: permRows.length, attendance: toCreate.length + toUpdate.length, skipped };
}

/** 旧DBへ直接接続して移行（ターミナル用） */
export async function migrateFromRender(prisma: PrismaClient, oldDatabaseUrl: string, log: (m: string) => void = () => {}): Promise<MigrateResult> {
  const data = await fetchFromOldDatabase(oldDatabaseUrl);
  log("旧DBに接続しました。");
  return importOldData(prisma, data, log);
}
