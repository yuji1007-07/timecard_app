// ============================================================
// signature.js … サイン画面
// 患者様が指またはApple Pencilで手書きサインをします。
// Canvas（お絵かき用の領域）に Pointer Events で描画します。
// ============================================================

import { getDraft, setDraft, saveApplication } from "../storage.js";
import { esc, go } from "../util.js";

export function render(container) {
  const draft = getDraft();
  if (!draft) {
    container.innerHTML = `<div class="empty-box"><p>入力データがありません。</p><a href="#/select" class="btn">最初から</a></div>`;
    return;
  }

  container.innerHTML = `
    <div class="page-head">
      <h1>サインのお願い</h1>
      <p class="page-head__desc">下の枠内に、指またはApple Pencilでご署名ください</p>
    </div>

    <div class="sign-wrap">
      <div class="sign-box">
        <canvas id="signCanvas" class="sign-canvas"></canvas>
        <span class="sign-box__placeholder" id="signPlaceholder">ここに署名</span>
      </div>
      <div class="sign-name">${esc(patientName(draft))} 様</div>
    </div>

    <div class="sign-actions no-print">
      <button id="clearBtn" class="btn btn--ghost btn--lg">やり直す</button>
      <a href="#/confirm" class="btn btn--ghost">← 確認に戻る</a>
      <button id="confirmBtn" class="btn btn--primary btn--lg">サインを確定 →</button>
    </div>
    <p id="signError" class="form-error"></p>
  `;

  const canvas = container.querySelector("#signCanvas");
  const placeholder = container.querySelector("#signPlaceholder");
  const ctx = canvas.getContext("2d");
  let drawing = false;
  let hasDrawn = false;

  // Canvasのサイズを表示領域に合わせる（高解像度対応でくっきり描画）
  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#1a2b4a"; // ネイビーのインク色
  }
  resizeCanvas();

  // 画面内の座標を取得
  function getPos(e) {
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function start(e) {
    drawing = true;
    hasDrawn = true;
    placeholder.style.display = "none";
    const p = getPos(e);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    e.preventDefault();
  }
  function move(e) {
    if (!drawing) return;
    const p = getPos(e);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    e.preventDefault();
  }
  function end(e) {
    drawing = false;
    e && e.preventDefault();
  }

  // Pointer Events なら指・マウス・Apple Pencil をまとめて扱える
  canvas.addEventListener("pointerdown", start);
  canvas.addEventListener("pointermove", move);
  canvas.addEventListener("pointerup", end);
  canvas.addEventListener("pointerleave", end);
  // 指でなぞった時に画面がスクロールしないようにする
  canvas.style.touchAction = "none";

  // やり直しボタン
  container.querySelector("#clearBtn").addEventListener("click", () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    hasDrawn = false;
    placeholder.style.display = "block";
  });

  // 確定ボタン → サイン画像を保存して申込書を確定、PDFプレビューへ
  const confirmBtn = container.querySelector("#confirmBtn");
  confirmBtn.addEventListener("click", async () => {
    if (!hasDrawn) {
      container.querySelector("#signError").textContent = "サインを記入してください。";
      return;
    }
    // Canvasの絵を画像データ(PNG)に変換して保存
    draft.signatureDataUrl = canvas.toDataURL("image/png");
    setDraft(draft);

    // 申込書として正式にサーバーへ保存（履歴に残る）
    confirmBtn.disabled = true;
    confirmBtn.textContent = "保存中…";
    try {
      await saveApplication(draft);
      go("/preview");
    } catch (e) {
      confirmBtn.disabled = false;
      confirmBtn.textContent = "サインを確定 →";
      container.querySelector("#signError").textContent =
        "保存に失敗しました。通信状態を確認してもう一度お試しください。";
    }
  });
}

// 氏名らしき項目を探して返す（「氏名」を含むラベルの値）
function patientName(draft) {
  const f = draft.fields.find((x) => x.label.includes("氏名") || x.label.includes("名前"));
  return f ? draft.fieldValues[f.id] || "" : "";
}
