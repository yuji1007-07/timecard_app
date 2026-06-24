import { prisma } from "@/lib/prisma";

// 設定のデフォルト値（DBに無ければこれを使う）
export const DEFAULT_SETTINGS: Record<string, string> = {
  weeklyDeadlineDay: "1", // 0=日 ... 6=土（締切曜日）
  weeklyDeadlineTime: "18:00",
  monthlyDeadlineDay: "5", // 毎月5日
  unsubmittedNotifyTime: "10:00",
  lineEnabled: "false",
  sheetsEnabled: "false",
  aiEnabled: "true",
  alertNotifyEnabled: "true",
  openaiModel: "gpt-4o-mini",
};

export async function getSetting(key: string): Promise<string | null> {
  const row = await prisma.setting.findUnique({ where: { key } });
  if (row) return row.value;
  return DEFAULT_SETTINGS[key] ?? null;
}

export async function getAllSettings(): Promise<Record<string, string>> {
  const rows = await prisma.setting.findMany();
  const result: Record<string, string> = { ...DEFAULT_SETTINGS };
  for (const r of rows) result[r.key] = r.value;
  return result;
}

export async function setSetting(key: string, value: string): Promise<void> {
  await prisma.setting.upsert({
    where: { key },
    create: { key, value },
    update: { value },
  });
}
