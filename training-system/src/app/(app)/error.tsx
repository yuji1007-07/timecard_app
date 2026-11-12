"use client";

// (app) セグメント内でエラーが起きたときのフォールバック（サイドバーは維持される）。
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <div className="max-w-md rounded-2xl border bg-card p-8 text-center shadow-sm">
        <div className="text-4xl">⚠️</div>
        <h1 className="mt-3 text-lg font-bold text-navy">この画面の表示に失敗しました</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          一時的なエラーの可能性があります。再読み込みしてください。直らない場合は少し時間をおいてお試しください。
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <button onClick={() => reset()} className="rounded-md bg-navy px-5 py-2 text-sm font-medium text-white hover:opacity-90">
            再読み込み
          </button>
          <a href="/dashboard" className="rounded-md border px-5 py-2 text-sm hover:bg-muted">
            ダッシュボードへ
          </a>
        </div>
        {error?.digest && <p className="mt-4 text-[11px] text-muted-foreground">コード: {error.digest}</p>}
      </div>
    </div>
  );
}
