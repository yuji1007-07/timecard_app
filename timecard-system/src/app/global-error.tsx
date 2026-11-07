"use client";

// アプリ全体で想定外のクライアントエラーが起きたときのフォールバック。
// 真っ白の "Application error" ではなく、案内＋再読み込みボタンを表示する。
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="ja">
      <body style={{ fontFamily: "system-ui, sans-serif", background: "#f8fafc", margin: 0 }}>
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div style={{ maxWidth: 440, textAlign: "center", background: "#fff", border: "1px solid #e2e8f0", borderRadius: 16, padding: "32px 28px", boxShadow: "0 4px 16px rgba(0,0,0,.06)" }}>
            <div style={{ fontSize: 40 }}>⚠️</div>
            <h1 style={{ fontSize: 20, margin: "10px 0 6px", color: "#1f2a44" }}>表示中に問題が発生しました</h1>
            <p style={{ fontSize: 14, color: "#64748b", lineHeight: 1.7, margin: "0 0 20px" }}>
              一時的なエラーの可能性があります。下のボタンで再読み込みしてください。<br />
              直らない場合は、少し待ってからもう一度お試しください。
            </p>
            <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
              <button
                onClick={() => reset()}
                style={{ background: "#1f2a44", color: "#fff", border: "none", borderRadius: 10, padding: "10px 20px", fontSize: 14, cursor: "pointer" }}
              >
                再読み込み
              </button>
              <button
                onClick={() => { window.location.href = "/dashboard"; }}
                style={{ background: "#fff", color: "#1f2a44", border: "1px solid #cbd5e1", borderRadius: 10, padding: "10px 20px", fontSize: 14, cursor: "pointer" }}
              >
                ダッシュボードへ
              </button>
            </div>
            {error?.digest && <p style={{ fontSize: 11, color: "#94a3b8", marginTop: 16 }}>コード: {error.digest}</p>}
          </div>
        </div>
      </body>
    </html>
  );
}
