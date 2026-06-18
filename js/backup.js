// ============================================================
// backup.js … 申込書をまとめてPDF化し、ZIPでダウンロードする
//
// 顧客管理ページの「📦 PDFをまとめてZIP保存」から呼ばれます。
// ブラウザだけでPDFを作るため、外部ライブラリ(CDN)を使います:
//   ・html2canvas … 画面の見た目を画像にする
//   ・jsPDF       … 画像をA4のPDFにする
//   ・JSZip       … 複数PDFを1つのZIPにまとめる
// 保存したZIPは、そのままGoogleドライブに上げればクラウド保管にもなります。
// ============================================================

import { paperHtml } from "./paper.js";

// 申込データから「カルテ番号・氏名」を取り出す（ファイル名に使う）
function fieldVal(app, keyword) {
  const f = (app.fields || []).find((x) => x.label.includes(keyword));
  return f ? (app.fieldValues[f.id] || "") : "";
}
// ファイル名・フォルダ名に使えない文字を全角や「_」に置き換える
function safe(name) {
  return (name || "").replace(/[\\/:*?"<>|]/g, "_").replace(/\s+/g, "").slice(0, 40) || "無題";
}

// 画像(canvas)をA4 PDFに貼る。縦に長い場合は複数ページに分ける。
function canvasToPdf(jsPDF, canvas) {
  const pdf = new jsPDF("p", "mm", "a4");
  const pageW = 210;
  const pageH = 297;
  const imgW = pageW;
  const imgH = (canvas.height * pageW) / canvas.width;
  const imgData = canvas.toDataURL("image/jpeg", 0.92);
  let heightLeft = imgH;
  let position = 0;
  pdf.addImage(imgData, "JPEG", 0, position, imgW, imgH);
  heightLeft -= pageH;
  while (heightLeft > 0) {
    position -= pageH;
    pdf.addPage();
    pdf.addImage(imgData, "JPEG", 0, position, imgW, imgH);
    heightLeft -= pageH;
  }
  return pdf;
}

// 署名などの画像が読み込み終わるまで待つ
function waitImages(root) {
  const imgs = Array.from(root.querySelectorAll("img"));
  return Promise.all(
    imgs.map((img) =>
      img.complete
        ? Promise.resolve()
        : new Promise((res) => {
            img.onload = res;
            img.onerror = res;
          })
    )
  );
}

// メイン処理：apps をすべてPDFにしてZIPのBlobを返す
// onProgress(done, total, app) で進捗を通知します。
export async function exportAppsToZip(apps, onProgress) {
  const JSZip = window.JSZip;
  const html2canvas = window.html2canvas;
  const jsPDF = window.jspdf && window.jspdf.jsPDF;
  if (!JSZip || !html2canvas || !jsPDF) {
    throw new Error("PDF生成ライブラリの読み込みに失敗しました。通信環境をご確認ください。");
  }

  const zip = new JSZip();

  // 画面外に「紙」を一時的に置いて、見た目を画像化する
  const stage = document.createElement("div");
  stage.style.position = "fixed";
  stage.style.left = "-10000px";
  stage.style.top = "0";
  stage.style.width = "794px"; // A4幅(約96dpi)
  stage.style.background = "#ffffff";
  document.body.appendChild(stage);

  try {
    for (let i = 0; i < apps.length; i++) {
      const a = apps[i];
      if (onProgress) onProgress(i, apps.length, a);

      stage.innerHTML = paperHtml(a);
      await waitImages(stage);
      const canvas = await html2canvas(stage.firstElementChild, {
        scale: 2,
        backgroundColor: "#ffffff",
        useCORS: true,
      });
      const pdf = canvasToPdf(jsPDF, canvas);
      const blob = pdf.output("blob");

      // 例: 狛江店/001_12345_山田太郎_2026-06-16.pdf
      const folder = safe(a.storeName || "店舗未設定");
      const karte = fieldVal(a, "カルテ") || "番号なし";
      const name = fieldVal(a, "氏名") || fieldVal(a, "名前") || "無記名";
      const date = a.applyDate || "";
      const fname = `${String(i + 1).padStart(3, "0")}_${safe(karte)}_${safe(name)}_${safe(date)}.pdf`;
      zip.file(`${folder}/${fname}`, blob);
    }

    if (onProgress) onProgress(apps.length, apps.length, null);
    return await zip.generateAsync({ type: "blob" });
  } finally {
    stage.remove();
  }
}

// Blobをファイルとしてダウンロードさせる
export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
