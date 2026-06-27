import { google } from "googleapis";
import { getSetting } from "@/lib/settings";

/**
 * 認証情報を取得する。次の2通りに対応:
 *  A) GOOGLE_SERVICE_ACCOUNT_JSON にサービスアカウントのJSONを丸ごと貼る（推奨・簡単）
 *  B) GOOGLE_SERVICE_ACCOUNT_EMAIL と GOOGLE_PRIVATE_KEY を個別に設定（従来方式）
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
      // JSONの貼り付けミスは下のフォールバックへ
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

// 出力シート名（仕様で定義された4シート）
export const SHEET_NAMES = {
  WEEKLY: "週次報告一覧",
  MONTHLY: "月次報告一覧",
  KDI: "KDI_Action履歴",
  FEEDBACK: "フィードバック履歴",
} as const;

// 各シートの見出し行（タブを自動作成したときに付与）
const KPI_HEADERS = ["日時", "対象期間", "店舗", "部門", "業態", "報告者", "KPI名", "目標", "現状", "着地"];
const SHEET_HEADERS: Record<string, string[]> = {
  [SHEET_NAMES.WEEKLY]: KPI_HEADERS,
  [SHEET_NAMES.MONTHLY]: KPI_HEADERS,
  [SHEET_NAMES.KDI]: ["日時", "対象期間", "店舗", "報告者", "関連KPI", "実行内容", "進捗", "担当"],
  [SHEET_NAMES.FEEDBACK]: ["日時", "対象期間", "店舗", "報告者", "フィードバック"],
};

// 指定タブが無ければ作成し、見出し行を付与する
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

/**
 * 指定シートに行を追記する。未設定 or OFF ならドライラン。
 * タブが存在しなければ自動作成し、見出し行を付ける。
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
