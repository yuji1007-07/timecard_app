import { google } from "googleapis";
import { getSetting } from "@/lib/settings";

export function isSheetsConfigured(): boolean {
  return !!(
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL &&
    process.env.GOOGLE_PRIVATE_KEY &&
    process.env.GOOGLE_SHEETS_SPREADSHEET_ID
  );
}

export type SheetSyncResult = { ok: boolean; message: string };

function getAuth() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!email || !key) return null;
  return new google.auth.JWT({
    email,
    key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
}

/**
 * 指定シートに行を追記する。未設定 or OFF ならドライラン。
 * rows: 2次元配列（行 x 列）。
 */
export async function appendRows(sheetName: string, rows: (string | number)[][]): Promise<SheetSyncResult> {
  const enabled = (await getSetting("sheetsEnabled")) === "true";
  if (!enabled) return { ok: false, message: "スプレッドシート同期が設定でOFFになっています。" };
  if (!isSheetsConfigured()) return { ok: false, message: "Google Sheets の認証情報が未設定です。" };

  const auth = getAuth();
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID!;
  if (!auth) return { ok: false, message: "認証に失敗しました。" };

  try {
    const sheets = google.sheets({ version: "v4", auth });
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

// 出力シート名（仕様で定義された4シート）
export const SHEET_NAMES = {
  WEEKLY: "週次報告一覧",
  MONTHLY: "月次報告一覧",
  KDI: "KDI_Action履歴",
  FEEDBACK: "フィードバック履歴",
} as const;
