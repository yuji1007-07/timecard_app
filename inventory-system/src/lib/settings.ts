import { prisma } from "@/lib/prisma";

// 設定のデフォルト値（DBに無ければこれを使う）
export const DEFAULT_SETTINGS: Record<string, string> = {
  stocktakeDeadlineDay: "30", // 毎月の棚卸締め日
  unsubmittedNotifyTime: "10:00", // 棚卸未実施アラート送信時刻
  diffThresholdCount: "1", // 在庫ズレ通知の閾値（件数）
  diffThresholdAmount: "0", // 在庫ズレ通知の閾値（金額）
  lowStockAlertEnabled: "true", // 在庫不足アラート ON/OFF
  taxRounding: "ROUND", // 税込→税抜の丸めルール ROUND/FLOOR/CEIL
  diffBasis: "WHOLESALE", // ズレ金額算出基準 WHOLESALE/NORMAL
  lineEnabled: "false",
  sheetsEnabled: "false",
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
