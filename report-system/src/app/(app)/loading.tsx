// 画面遷移中に即座に表示されるスケルトン。サーバー側のデータ取得を待つ間も
// 「固まった」感じを無くし、体感速度を上げる。
export default function Loading() {
  return (
    <div className="animate-pulse space-y-6" aria-label="読み込み中">
      {/* 見出し */}
      <div className="space-y-2">
        <div className="h-7 w-48 rounded bg-muted" />
        <div className="h-4 w-72 max-w-full rounded bg-muted/70" />
      </div>

      {/* カード風のプレースホルダ */}
      {[0, 1, 2].map((i) => (
        <div key={i} className="rounded-lg border bg-card p-5 shadow-sm">
          <div className="mb-4 h-5 w-40 rounded bg-muted" />
          <div className="space-y-2.5">
            <div className="h-4 w-full rounded bg-muted/70" />
            <div className="h-4 w-5/6 rounded bg-muted/70" />
            <div className="h-4 w-4/6 rounded bg-muted/70" />
          </div>
        </div>
      ))}
    </div>
  );
}
