"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { submitQuiz, type QuizResult } from "./actions";

export type QuizQuestionView = {
  id: string;
  text: string;
  /** 表示順はサーバーで毎回シャッフル済み。index は元の番号（採点用） */
  choices: { index: number; text: string }[];
};

export function QuizSection({
  videoId,
  questions,
  passPercent,
}: {
  videoId: string;
  questions: QuizQuestionView[];
  passPercent: number;
}) {
  // 採点結果を見ている間は並びを固定し、「もう一度受ける」で新しい並び（サーバーが再シャッフル）に切り替える
  const [round, setRound] = useState(0);
  const [frozen, setFrozen] = useState(questions);
  return (
    <QuizRound
      key={round}
      videoId={videoId}
      questions={frozen}
      passPercent={passPercent}
      onRetry={() => {
        setFrozen(questions);
        setRound((r) => r + 1);
      }}
    />
  );
}

function QuizRound({
  videoId,
  questions,
  passPercent,
  onRetry,
}: {
  videoId: string;
  questions: QuizQuestionView[];
  passPercent: number;
  onRetry: () => void;
}) {
  const [state, action, pending] = useActionState(submitQuiz, null);
  const [picked, setPicked] = useState<Record<string, number>>({});
  const router = useRouter();
  const result: QuizResult | null = state && "success" in state ? state : null;
  const error = state && "error" in state ? state.error : null;

  useEffect(() => {
    if (result) router.refresh();
  }, [result, router]);

  const answered = Object.keys(picked).length;

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="videoId" value={videoId} />

      {result && (
        <div
          data-testid="quiz-result"
          className={`rounded-lg border p-4 text-center ${result.passed ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}`}
        >
          <div className={`text-2xl font-bold ${result.passed ? "text-green-700" : "text-red-700"}`}>
            {result.passed ? "合格" : "不合格"}　{result.percent}点
          </div>
          <div className="mt-1 text-sm text-muted-foreground">
            {result.total}問中 {result.correct}問 正解（{passPercent}点以上で合格）
          </div>
        </div>
      )}

      {questions.map((q, qi) => {
        const r = result?.results[q.id];
        return (
          <fieldset key={q.id} className="space-y-2" data-testid="quiz-question">
            <legend className="mb-2 text-base font-semibold leading-snug text-navy">
              <span className="mr-1.5 text-muted-foreground">Q{qi + 1}.</span>
              {q.text}
            </legend>
            {q.choices.map((c) => {
              const checked = picked[q.id] === c.index;
              const isCorrect = r ? c.index === r.correctIndex : false;
              const isWrongPick = r ? c.index === r.selectedIndex && !isCorrect : false;
              const cls = r
                ? isCorrect
                  ? "border-green-500 bg-green-50"
                  : isWrongPick
                    ? "border-red-400 bg-red-50"
                    : "border-input opacity-70"
                : checked
                  ? "border-navy bg-navy/5 ring-1 ring-navy"
                  : "border-input hover:bg-muted";
              return (
                <label key={c.index} className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 text-sm leading-snug transition-colors ${cls}`}>
                  <input
                    type="radio"
                    name={`q_${q.id}`}
                    value={c.index}
                    checked={checked}
                    onChange={() => !result && setPicked((p) => ({ ...p, [q.id]: c.index }))}
                    className="h-5 w-5 shrink-0 accent-[#1e3a5f]"
                  />
                  <span className="flex-1">{c.text}</span>
                  {r && isCorrect && <CheckCircle2 className="h-5 w-5 shrink-0 text-green-600" />}
                  {r && isWrongPick && <XCircle className="h-5 w-5 shrink-0 text-red-500" />}
                </label>
              );
            })}
            {r && (
              <div className="rounded-md bg-muted/60 p-3 text-sm leading-relaxed">
                <span className={`mr-2 font-bold ${r.selectedIndex === r.correctIndex ? "text-green-700" : "text-red-600"}`}>
                  {r.selectedIndex === r.correctIndex ? "正解" : "不正解"}
                </span>
                {r.explanation && <span>解説：{r.explanation}</span>}
              </div>
            )}
          </fieldset>
        );
      })}

      {error && <p className="text-sm text-destructive">{error}</p>}

      {result ? (
        <Button type="button" variant="outline" className="h-12 w-full text-base" onClick={onRetry}>
          もう一度受ける（問題の並びが変わります）
        </Button>
      ) : (
        <Button type="submit" className="h-12 w-full text-base" disabled={pending || answered < questions.length}>
          {pending ? "採点中..." : answered < questions.length ? `あと${questions.length - answered}問 選んでください` : "採点する"}
        </Button>
      )}
    </form>
  );
}
