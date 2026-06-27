"use client";

export function PrintToolbar({ count, summary }: { count: number; summary: string }) {
  return (
    <div className="no-print sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 border-b bg-white px-5 py-3 shadow-sm">
      <div className="text-sm">
        <span className="font-semibold">PDFバックアップ</span>
        <span className="ml-2 text-gray-500">{summary}／{count}件</span>
      </div>
      <div className="flex items-center gap-3">
        <span className="hidden text-xs text-gray-500 sm:inline">
          ボタンを押すか Cmd/Ctrl+P → 送信先「PDFに保存」で保存できます
        </span>
        <button
          onClick={() => window.print()}
          className="rounded-md bg-[#1e2a4a] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          🖨 印刷 / PDFで保存
        </button>
      </div>
    </div>
  );
}
