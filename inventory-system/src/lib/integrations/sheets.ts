import { google } from "googleapis";
import { getSetting } from "@/lib/settings";

/**
 * 認証情報を取得。週次報告システムと同じ方式（サービスアカウント＋シート共有）。
 *  A) GOOGLE_SERVICE_ACCOUNT_JSON にJSONを丸ごと貼る（推奨）
 *  B) GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_PRIVATE_KEY を個別設定
 */
function getCredentials(): { email: string; key: string } | null {
  const json = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (json) {
    try {
      const p = JSON.parse(json);
      if (p.client_email && p.private_key) {
        return { email: String(p.client_email), key: String(p.private_key).replace(/\\n/g, "\n") };
      }
    } catch {
      /* フォールバックへ */
    }
  }
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (email && key) return { email, key };
  return null;
}

export function isSheetsConfigured(): boolean {
  return !!(getCredentials() && process.env.GOOGLE_SHEETS_SPREADSHEET_ID);
}

export type SheetSyncResult = { ok: boolean; message: string };

function getAuth() {
  const cred = getCredentials();
  if (!cred) return null;
  return new google.auth.JWT({
    email: cred.email,
    key: cred.key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
}

// 出力シート名（仕様で定義された3シート）
export const SHEET_NAMES = {
  TRANSACTIONS: "取引履歴",
  STOCKTAKE: "棚卸履歴",
  SNAPSHOT: "在庫スナップショット",
} as const;

const SHEET_HEADERS: Record<string, string[]> = {
  [SHEET_NAMES.TRANSACTIONS]: [
    "日付", "店舗", "取引種別", "ブランド", "商品名", "数量",
    "単価(税抜)", "単価(税込)", "金額", "担当者", "移動先", "メモ",
  ],
  [SHEET_NAMES.STOCKTAKE]: [
    "確定日", "対象月", "店舗", "ブランド", "商品名",
    "理論在庫", "実在庫", "ズレ", "ズレ金額", "担当者",
  ],
  [SHEET_NAMES.SNAPSHOT]: [
    "出力日", "店舗", "ブランド", "商品名", "在庫数", "卸価格", "在庫金額",
  ],
};

type SheetsClient = ReturnType<typeof google.sheets>;
async function ensureSheet(sheets: SheetsClient, spreadsheetId: string, title: string) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId, fields: "sheets.properties.title" });
  const exists = (meta.data.sheets ?? []).some((s) => s.properties?.title === title);
  if (exists) return;
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: { requests: [{ addSheet: { properties: { title } } }] },
  });
  const headers = SHEET_HEADERS[title];
  if (headers) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${title}!A1`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [headers] },
    });
  }
}

/** 指定シートに行を追記。未設定 or OFF ならドライラン。タブが無ければ自動作成。 */
export async function appendRows(sheetName: string, rows: (string | number)[][]): Promise<SheetSyncResult> {
  const enabled = (await getSetting("sheetsEnabled")) === "true";
  if (!enabled) return { ok: false, message: "スプレッドシート同期が設定でOFFになっています。" };
  if (!isSheetsConfigured()) return { ok: false, message: "Google Sheets の認証情報が未設定です。" };

  const auth = getAuth();
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID!;
  if (!auth) return { ok: false, message: "認証に失敗しました。" };

  try {
    const sheets = google.sheets({ version: "v4", auth });
    await ensureSheet(sheets, spreadsheetId, sheetName);
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${sheetName}!A1`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: rows },
    });
    return { ok: true, message: `${rows.length}行を「${sheetName}」に出力しました。` };
  } catch (e) {
    return { ok: false, message: `スプレッドシート出力エラー: ${(e as Error).message}` };
  }
}
