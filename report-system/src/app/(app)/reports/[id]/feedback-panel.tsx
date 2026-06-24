"use client";

import { useState, useTransition } from "react";
import { generateFeedbackAction, saveFeedbackAction, sendFeedbackAction } from "../feedback-actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Sparkles } from "lucide-react";

export function FeedbackPanel({
  reportId,
  initialContent,
  sendStatus,
  sentTo,
}: {
  reportId: string;
  initialContent: string;
  sendStatus: string;
  sentTo: string | null;
}) {
  const [content, setContent] = useState(initialContent);
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState<"gen" | "save" | "send" | null>(null);
  const [note, setNote] = useState<string | null>(null);

  function generate() {
    setBusy("gen");
    setNote(null);
    startTransition(async () => {
      try {
        const res = await generateFeedbackAction(reportId);
        setContent(res.content);
        setNote(res.usedAI ? "AIで生成しました。内容を編集して保存できます。" : "APIキー未設定のためテンプレート下書きを生成しました。");
      } catch (e) {
        setNote((e as Error).message);
      } finally {
        setBusy(null);
      }
    });
  }
  function save() {
    setBusy("save");
    setNote(null);
    startTransition(async () => {
      await saveFeedbackAction(reportId, content);
      setNote("保存しました。");
      setBusy(null);
    });
  }
  function send() {
    setBusy("send");
    setNote(null);
    startTransition(async () => {
      await saveFeedbackAction(reportId, content);
      const res = await sendFeedbackAction(reportId);
      setNote(res.message);
      setBusy(null);
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={generate} disabled={pending} variant="default" size="sm">
          <Sparkles className="h-4 w-4" />
          {busy === "gen" ? "生成中..." : "AIフィードバック生成"}
        </Button>
        <Button onClick={save} disabled={pending || !content} variant="outline" size="sm">
          {busy === "save" ? "保存中..." : "下書き保存"}
        </Button>
        <Button onClick={send} disabled={pending || !content} variant="secondary" size="sm">
          {busy === "send" ? "送信中..." : "責任者へ送信（送信済にする）"}
        </Button>
        {sendStatus === "SENT" && <Badge variant="good">送信済{sentTo ? `：${sentTo}` : ""}</Badge>}
      </div>

      <Textarea
        rows={16}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="「AIフィードバック生成」を押すと、KPI差分・前回KDI進捗・整合性チェックをもとに下書きが作成されます。"
        className="font-mono text-sm"
      />
      {note && <p className="text-sm text-muted-foreground">{note}</p>}
    </div>
  );
}
