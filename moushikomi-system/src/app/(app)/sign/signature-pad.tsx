"use client";

// サイン画面（旧アプリ signature.js の移植）
// 患者様が指またはApple Pencilで手書きサインをします。
// Canvas（お絵かき用の領域）に Pointer Events で描画します。

import { useActionState, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { clearDraft, getDraft, setDraft } from "@/lib/draft";
import { patientName, type ApplicationData } from "@/lib/types";
import { saveApplication, type SaveState } from "./actions";

export function SignaturePad() {
  const router = useRouter();
  const [draft, setDraftState] = useState<ApplicationData | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [hasDrawn, setHasDrawn] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);
  const jsonRef = useRef<HTMLInputElement>(null);
  const [state, action, pending] = useActionState<SaveState, FormData>(saveApplication, null);

  useEffect(() => {
    setDraftState(getDraft());
    setLoaded(true);
  }, []);

  // Canvasのサイズを表示領域に合わせる（高解像度対応でくっきり描画）
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#1a2b4a"; // ネイビーのインク色
    // 指でなぞった時に画面がスクロールしないようにする
    canvas.style.touchAction = "none";
  }, [loaded, draft]);

  // 保存が終わったら下書きを消してプレビューへ
  useEffect(() => {
    if (state?.ok) {
      clearDraft();
      router.push(`/print/${encodeURIComponent(state.id)}?done=1`);
    } else if (state && !state.ok) {
      setError(state.message);
    }
  }, [state, router]);

  // 画面内の座標を取得
  function getPos(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }
  function start(e: React.PointerEvent<HTMLCanvasElement>) {
    const ctx = e.currentTarget.getContext("2d");
    if (!ctx) return;
    drawingRef.current = true;
    setHasDrawn(true);
    const p = getPos(e);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    e.preventDefault();
  }
  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;
    const ctx = e.currentTarget.getContext("2d");
    if (!ctx) return;
    const p = getPos(e);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    e.preventDefault();
  }
  function end(e?: React.PointerEvent<HTMLCanvasElement>) {
    drawingRef.current = false;
    e?.preventDefault();
  }

  // やり直しボタン
  function clear() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
    setError("");
  }

  // 確定ボタン → サイン画像を保存して申込書を確定、PDFプレビューへ
  function confirm() {
    const canvas = canvasRef.current;
    if (!draft || !canvas) return;
    if (!hasDrawn) {
      setError("サインを記入してください。");
      return;
    }
    // Canvasの絵を画像データ(PNG)に変換して保存
    const updated = { ...draft, signatureDataUrl: canvas.toDataURL("image/png") };
    setDraft(updated);
    setDraftState(updated);
    if (jsonRef.current) jsonRef.current.value = JSON.stringify(updated);
    setError("");
    formRef.current?.requestSubmit();
  }

  if (!loaded) return <div className="py-12 text-center text-muted-foreground">⏳ 読み込み中…</div>;
  if (!draft) {
    return (
      <div className="empty-box">
        <p>入力データがありません。</p>
        <Link href="/select" className="btn">
          最初から
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-navy md:text-2xl">サインのお願い</h1>
        <p className="mt-1 text-sm text-muted-foreground">下の枠内に、指またはApple Pencilでご署名ください</p>
      </div>

      <div className="sign-wrap">
        <div className="sign-box">
          <canvas
            id="signCanvas"
            ref={canvasRef}
            className="sign-canvas"
            onPointerDown={start}
            onPointerMove={move}
            onPointerUp={end}
            onPointerLeave={end}
          />
          {!hasDrawn && (
            <span className="sign-box__placeholder" id="signPlaceholder">
              ここに署名
            </span>
          )}
        </div>
        <div className="sign-name">{patientName(draft, "")} 様</div>
      </div>

      <form ref={formRef} action={action} className="hidden">
        <input ref={jsonRef} type="hidden" name="json" defaultValue="" />
      </form>

      <div className="sign-actions no-print">
        <button id="clearBtn" type="button" className="btn btn--ghost btn--lg" onClick={clear} disabled={pending}>
          やり直す
        </button>
        <Link href="/confirm" className="btn btn--ghost">
          ← 確認に戻る
        </Link>
        <button id="confirmBtn" type="button" className="btn btn--primary btn--lg" onClick={confirm} disabled={pending}>
          {pending ? "保存中…" : "サインを確定 →"}
        </button>
      </div>
      <p id="signError" className="form-error mx-auto max-w-[820px] text-center">
        {error}
      </p>
    </div>
  );
}
