"use client";

export function PrintToolbar({ title }: { title: string }) {
  return (
    <div className="no-print mb-4 flex items-center justify-between rounded-lg border bg-card px-4 py-3">
      <div className="text-sm text-muted-foreground">{title}</div>
      <div className="flex gap-2">
        <button onClick={() => window.print()} className="rounded-md bg-navy px-4 py-2 text-sm text-white">
          印刷 / PDF保存
        </button>
        <button onClick={() => window.close()} className="rounded-md border px-4 py-2 text-sm">
          閉じる
        </button>
      </div>
    </div>
  );
}
