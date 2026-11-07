// ============================================================
// 下書き（入力→確認→サイン→保存の間だけ、この端末のブラウザに一時保存）
// 旧アプリ storage.js の getDraft / setDraft / clearDraft と同じキー名。
// サーバーには保存せず、申込書として確定した時点で消します。
// ============================================================

import type { ApplicationData } from "./types";

const KEY_DRAFT = "moushikomi_draft_v1";

function storage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export function getDraft(): ApplicationData | null {
  const s = storage();
  if (!s) return null;
  try {
    const raw = s.getItem(KEY_DRAFT);
    return raw ? (JSON.parse(raw) as ApplicationData) : null;
  } catch {
    return null;
  }
}

export function setDraft(draft: ApplicationData): void {
  const s = storage();
  if (!s) return;
  try {
    s.setItem(KEY_DRAFT, JSON.stringify(draft));
  } catch {
    /* 保存できなくても画面は続行 */
  }
}

export function clearDraft(): void {
  const s = storage();
  if (!s) return;
  try {
    s.removeItem(KEY_DRAFT);
  } catch {
    /* noop */
  }
}
