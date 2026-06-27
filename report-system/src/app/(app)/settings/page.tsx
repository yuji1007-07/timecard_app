import { requireAreaManager } from "@/lib/session";
import { getAllSettings } from "@/lib/settings";
import { isOpenAIConfigured } from "@/lib/integrations/openai";
import { isLineConfigured } from "@/lib/integrations/line";
import { isSheetsConfigured } from "@/lib/integrations/sheets";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SettingsForm } from "./settings-form";

export default async function SettingsPage() {
  await requireAreaManager();
  const settings = await getAllSettings();

  const integrations = [
    { name: "OpenAI / ChatGPT API", ok: isOpenAIConfigured(), env: "OPENAI_API_KEY", purpose: "AIフィードバック生成" },
    { name: "Google Sheets API", ok: isSheetsConfigured(), env: "GOOGLE_SERVICE_ACCOUNT_JSON / GOOGLE_SHEETS_SPREADSHEET_ID", purpose: "報告データの自動出力" },
    { name: "LINE Messaging API", ok: isLineConfigured(), env: "LINE_CHANNEL_ACCESS_TOKEN", purpose: "未提出・フィードバック・要注意通知" },
  ];

  return (
    <div>
      <PageHeader title="通知・連携設定" description="締切・通知のON/OFFと、外部連携（AI / スプレッドシート / LINE）の状態を管理します。" />

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>外部連携の接続状態</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {integrations.map((i) => (
            <div key={i.name} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{i.name}</span>
                  {i.ok ? <Badge variant="good">接続準備OK</Badge> : <Badge variant="muted">未設定</Badge>}
                </div>
                <div className="text-xs text-muted-foreground">{i.purpose}</div>
              </div>
              <code className="rounded bg-muted px-2 py-1 text-xs text-muted-foreground">{i.env}</code>
            </div>
          ))}
          <p className="text-xs text-muted-foreground">
            ※ APIキー等は <code>.env</code> に設定してください（<code>.env.example</code> 参照）。キーを入れて下のトグルをONにすると連携が有効になります。未設定でもアプリは動作し、連携はスキップされます。
          </p>
        </CardContent>
      </Card>

      <SettingsForm settings={settings} />
    </div>
  );
}
