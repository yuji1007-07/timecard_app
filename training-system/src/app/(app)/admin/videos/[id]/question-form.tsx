"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { deleteQuestion, saveQuestion } from "../actions";
import { keepForm } from "@/lib/keep-form";

export type EditableQuestion = {
  id: string;
  sortOrder: number;
  text: string;
  choices: string[];
  correctIndex: number;
  explanation: string;
};

function QuestionFields({ q }: { q?: EditableQuestion }) {
  const [correct, setCorrect] = useState(q?.correctIndex ?? 0);
  return (
    <>
      <div className="space-y-1.5">
        <Label>問題文 *</Label>
        <Textarea name="text" rows={2} defaultValue={q?.text} required />
      </div>
      <div className="space-y-2">
        <Label>選択肢（4つ）* ― 正解の選択肢の ○ を選んでください</Label>
        {[0, 1, 2, 3].map((i) => (
          <label key={i} className={`flex items-center gap-2 rounded-md border p-2 ${correct === i ? "border-green-500 bg-green-50" : "border-input"}`}>
            <input type="radio" name="correctIndex" value={i} checked={correct === i} onChange={() => setCorrect(i)} className="h-5 w-5 shrink-0 accent-green-600" aria-label={`選択肢${i + 1}を正解にする`} />
            <Input name={`choice${i}`} defaultValue={q?.choices[i]} required placeholder={`選択肢${i + 1}`} className="bg-background" />
            {correct === i && <span className="shrink-0 text-xs font-bold text-green-700">正解</span>}
          </label>
        ))}
        <p className="text-xs text-muted-foreground">スタッフに出すときは、問題と選択肢の並びを毎回シャッフルします。</p>
      </div>
      <div className="space-y-1.5">
        <Label>解説（回答後に表示）</Label>
        <Textarea name="explanation" rows={2} defaultValue={q?.explanation} />
      </div>
    </>
  );
}

export function QuestionEditor({ videoId, q, no }: { videoId: string; q: EditableQuestion; no: number }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(saveQuestion, null);
  const [delState, delAction, delPending] = useActionState(deleteQuestion, null);
  const router = useRouter();
  useEffect(() => {
    if (state?.success) {
      setOpen(false);
      router.refresh();
    }
  }, [state, router]);
  useEffect(() => {
    if (delState?.success) router.refresh();
  }, [delState, router]);

  return (
    <div className="rounded-lg border p-4" data-testid="admin-question">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-medium leading-snug">
            <span className="mr-1.5 text-muted-foreground">Q{no}.</span>
            {q.text}
          </div>
          {!open && (
            <ul className="mt-2 space-y-0.5 text-sm">
              {q.choices.map((c, i) => (
                <li key={i} className={i === q.correctIndex ? "font-semibold text-green-800" : "text-muted-foreground"}>
                  {i === q.correctIndex ? "◎ " : "・ "}
                  {c}
                </li>
              ))}
              {q.explanation && <li className="pt-1 text-xs text-muted-foreground">解説：{q.explanation}</li>}
            </ul>
          )}
        </div>
        <Button type="button" size="sm" variant="outline" onClick={() => setOpen((v) => !v)}>
          {open ? "閉じる" : "編集"}
        </Button>
      </div>
      {open && (
        <div className="mt-4 space-y-4">
          <form onSubmit={keepForm(action)} className="space-y-4">
            <input type="hidden" name="id" value={q.id} />
            <input type="hidden" name="videoId" value={videoId} />
            <QuestionFields q={q} />
            <div className="space-y-1.5">
              <Label>並び順</Label>
              <Input name="sortOrder" type="number" defaultValue={q.sortOrder} className="w-28" />
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" disabled={pending}>
                {pending ? "保存中..." : "問題を更新する"}
              </Button>
              {state?.error && <span className="text-sm text-destructive">{state.error}</span>}
            </div>
          </form>
          <form
            action={delAction}
            onSubmit={(e) => {
              if (!confirm("この問題を削除しますか？この問題への回答記録（正答率の集計）も消えます。")) e.preventDefault();
            }}
          >
            <input type="hidden" name="id" value={q.id} />
            <Button type="submit" size="sm" variant="ghost" className="text-destructive hover:text-destructive" disabled={delPending}>
              {delPending ? "削除中..." : "この問題を削除"}
            </Button>
            {delState?.error && <span className="ml-2 text-sm text-destructive">{delState.error}</span>}
          </form>
        </div>
      )}
    </div>
  );
}

export function NewQuestionForm({ videoId }: { videoId: string }) {
  const [open, setOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const [state, action, pending] = useActionState(saveQuestion, null);
  const router = useRouter();
  useEffect(() => {
    if (state?.success) {
      setOpen(false);
      setFormKey((k) => k + 1);
      router.refresh();
    }
  }, [state, router]);

  return (
    <div>
      <Button type="button" onClick={() => setOpen((v) => !v)} variant={open ? "outline" : "default"}>
        {open ? "キャンセル" : "＋ 問題を追加"}
      </Button>
      {open && (
        <form key={formKey} onSubmit={keepForm(action)} className="mt-3 space-y-4 rounded-lg border bg-muted/30 p-4">
          <input type="hidden" name="videoId" value={videoId} />
          <QuestionFields />
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={pending}>
              {pending ? "追加中..." : "問題を追加する"}
            </Button>
            {state?.error && <span className="text-sm text-destructive">{state.error}</span>}
          </div>
        </form>
      )}
    </div>
  );
}
