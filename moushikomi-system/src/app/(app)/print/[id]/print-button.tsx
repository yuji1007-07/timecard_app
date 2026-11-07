"use client";

export function PrintButton() {
  return (
    <button id="printBtn" type="button" className="btn btn--primary btn--lg" onClick={() => window.print()}>
      🖨 印刷する
    </button>
  );
}
