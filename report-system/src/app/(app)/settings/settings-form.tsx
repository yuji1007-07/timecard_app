"use client";

import { useActionState } from "react";
import { saveSettings } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const selectClass = "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm";
const DAYS = ["日", "月", "火", "水", "木", "金", "土"];

export function SettingsForm({ settings }: { settings: Record<string, string> }) {
  const [state, action, pending] = useActionState(saveSettings, null);

  const toggle = (key: string, label: string, desc: string) => (
    <label className="flex items-start justify-between gap-3 rounded-md border p-3">
      <span>
        <span className="text-sm font-medium">{label}</span>
        <span className="block text-xs text-muted-foreground">{desc}</span>
      </span>
      <input type="checkbox" name={key} defaultChecked={settings[key] === "true"} className="mt-1 h-5 w-5 rounded border-input" />
    </label>
  );

  return (
    <form action={action} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>締切設定</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label>週次報告の締切曜日</Label>
            <select name="weeklyDeadlineDay" defaultValue={settings.weeklyDeadlineDay} className={selectClass}>
              {DAYS.map((d, i) => (<option key={i} value={String(i)}>{d}曜日</option>))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>週次報告の締切時間</Label>
            <Input name="weeklyDeadlineTime" type="time" defaultValue={settings.weeklyDeadlineTime} />
          </div>
          <div className="space-y-1.5">
            <Label>月次報告の締切日（毎月）</Label>
            <Input name="monthlyDeadlineDay" type="number" min={1} max={31} defaultValue={settings.monthlyDeadlineDay} />
          </div>
          <div className="space-y-1.5">
            <Label>未提出通知の送信時間</Label>
            <Input name="unsubmittedNotifyTime" type="time" defaultValue={settings.unsubmittedNotifyTime} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>機能のON/OFF</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          {toggle("lineEnabled", "LINE通知", "未提出・フィードバック・要注意通知をLINEで送信")}
          {toggle("sheetsEnabled", "Googleスプレッドシート同期", "報告・フィードバックをシートへ自動出力")}
          {toggle("aiEnabled", "AI分析", "AIフィードバック生成を有効化")}
          {toggle("alertNotifyEnabled", "要注意通知", "要注意条件に該当したら管理者へ通知")}
          <div className="space-y-1.5 md:col-span-2">
            <Label>OpenAIモデル</Label>
            <Input name="openaiModel" defaultValue={settings.openaiModel} placeholder="gpt-4o-mini" />
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>{pending ? "保存中..." : "設定を保存"}</Button>
        {state?.success && <span className="text-sm text-green-600">保存しました。</span>}
      </div>
    </form>
  );
}
