import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { requireAreaManager } from "@/lib/session";
import { getAllSettings } from "@/lib/settings";
import { isLineConfigured } from "@/lib/integrations/line";
import { isSheetsConfigured } from "@/lib/integrations/sheets";
import { ROUNDING, DIFF_BASIS } from "@/lib/constants";
import { saveSettings } from "./actions";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  await requireAreaManager();
  const s = await getAllSettings();
  const lineReady = isLineConfigured();
  const sheetsReady = isSheetsConfigured();
  const sel = "h-10 w-full rounded-md border border-input bg-background px-3 text-sm";

  return (
    <div>
      <PageHeader title="通知・連携設定" description="棚卸締め日・ズレ閾値・税計算・LINE/Sheets連携を設定します。" />
      <form action={saveSettings} className="space-y-4">
        {/* 棚卸・アラート */}
        <Card>
          <CardHeader><CardTitle className="text-base">棚卸・アラート</CardTitle></CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1">
              <Label>棚卸の締め日（毎月◯日）</Label>
              <Input name="stocktakeDeadlineDay" type="number" min={1} max={31} defaultValue={s.stocktakeDeadlineDay} />
            </div>
            <div className="space-y-1">
              <Label>棚卸未実施アラートの送信時刻</Label>
              <Input name="unsubmittedNotifyTime" type="time" defaultValue={s.unsubmittedNotifyTime} />
            </div>
            <div className="space-y-1">
              <Label>在庫ズレ通知の閾値（件数 以上で通知）</Label>
              <Input name="diffThresholdCount" type="number" min={0} defaultValue={s.diffThresholdCount} />
            </div>
            <div className="space-y-1">
              <Label>在庫ズレ通知の閾値（金額 以上で通知。0で無効）</Label>
              <Input name="diffThresholdAmount" type="number" min={0} defaultValue={s.diffThresholdAmount} />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input name="lowStockAlertEnabled" type="checkbox" defaultChecked={s.lowStockAlertEnabled === "true"} className="h-4 w-4" />
              在庫不足アラートを有効にする
            </label>
          </CardContent>
        </Card>

        {/* 税・金額計算 */}
        <Card>
          <CardHeader><CardTitle className="text-base">税・金額計算</CardTitle></CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1">
              <Label>税込→税抜の丸めルール</Label>
              <select name="taxRounding" defaultValue={s.taxRounding} className={sel}>
                {Object.entries(ROUNDING).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label>ズレ金額の算出基準</Label>
              <select name="diffBasis" defaultValue={s.diffBasis} className={sel}>
                {Object.entries(DIFF_BASIS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
          </CardContent>
        </Card>

        {/* LINE */}
        <Card>
          <CardHeader><CardTitle className="text-base">LINE通知</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className={`rounded-md border p-3 text-sm ${lineReady ? "border-green-200 bg-green-50 text-green-700" : "border-yellow-200 bg-yellow-50 text-yellow-700"}`}>
              {lineReady
                ? "LINE_CHANNEL_ACCESS_TOKEN は設定済みです。下のスイッチをONにすると通知が有効になります。"
                : ".env の LINE_CHANNEL_ACCESS_TOKEN が未設定です。設定すると通知が有効化できます（未設定でもアプリは動作します）。"}
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input name="lineEnabled" type="checkbox" defaultChecked={s.lineEnabled === "true"} className="h-4 w-4" />
              LINE通知を有効にする（送信先＝ユーザー管理で本部のLINE IDを登録）
            </label>
          </CardContent>
        </Card>

        {/* Sheets */}
        <Card>
          <CardHeader><CardTitle className="text-base">Googleスプレッドシート連携</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className={`rounded-md border p-3 text-sm ${sheetsReady ? "border-green-200 bg-green-50 text-green-700" : "border-yellow-200 bg-yellow-50 text-yellow-700"}`}>
              {sheetsReady
                ? "サービスアカウントとスプレッドシートIDは設定済みです。"
                : ".env の GOOGLE_SERVICE_ACCOUNT_JSON（または EMAIL/PRIVATE_KEY）と GOOGLE_SHEETS_SPREADSHEET_ID を設定してください。"}
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input name="sheetsEnabled" type="checkbox" defaultChecked={s.sheetsEnabled === "true"} className="h-4 w-4" />
              スプレッドシート同期を有効にする（取引・棚卸確定時に自動出力）
            </label>
          </CardContent>
        </Card>

        <Button type="submit">設定を保存</Button>
      </form>
    </div>
  );
}
