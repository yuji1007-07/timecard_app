"use client";

// 患者様確認画面（旧アプリ patientConfirm.js の移植）
// 患者様にiPadを見せる画面です。文字大きめ・余白広めで見やすく。
// 内容を確認 → チェック → サイン画面へ進みます。

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getDraft, setDraft } from "@/lib/draft";
import { formatDateJa } from "@/lib/format";
import type { ApplicationData } from "@/lib/types";

export function ConfirmView() {
  const router = useRouter();
  const [draft, setDraftState] = useState<ApplicationData | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setDraftState(getDraft());
    setLoaded(true);
  }, []);

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

  const checked = draft.checkedItems || [];

  // チェック状態を下書きに反映（戻っても消えないように）
  function toggle(id: string, on: boolean) {
    if (!draft) return;
    const next = on ? [...checked.filter((c) => c !== id), id] : checked.filter((c) => c !== id);
    const updated = { ...draft, checkedItems: next };
    setDraftState(updated);
    setDraft(updated);
  }

  // サイン画面へ進む（全チェック必須）
  function toSign() {
    if (!draft) return;
    const allChecked = (draft.checks || []).every((c) => checked.includes(c.id));
    if (!allChecked) {
      setError("すべての確認項目にチェックしてください。");
      return;
    }
    router.push("/sign");
  }

  const infoRows = draft.fields.filter((f) => (draft.fieldValues[f.id] || "").trim() !== "");
  const hasPlan = draft.planName || draft.monthlyFee || draft.initialFee;

  return (
    <div>
      <div className="confirm-paper">
        <div className="confirm-paper__header">
          <h1 className="confirm-paper__title">{draft.templateName}</h1>
          <div className="confirm-paper__date">申込日：{formatDateJa(draft.applyDate)}</div>
        </div>

        {draft.bodySnapshot && <p className="confirm-body whitespace-pre-wrap">{draft.bodySnapshot}</p>}

        <div className="confirm-block">
          <h3 className="confirm-block__title">お申し込み内容</h3>
          <Row label="店舗" value={draft.storeName} />
          {draft.staffName && <Row label="担当者" value={draft.staffName} />}
          {infoRows.map((f) => (
            <Row key={f.id} label={f.label} value={draft.fieldValues[f.id]} />
          ))}
        </div>

        {hasPlan && (
          <div className="confirm-block">
            <h3 className="confirm-block__title">プラン・料金</h3>
            {draft.planName && <Row label="プラン" value={draft.planName} />}
            {draft.monthlyFee && <Row label="月額料金" value={draft.monthlyFee + " 円"} />}
            {draft.initialFee && <Row label="初回費用" value={draft.initialFee + " 円"} />}
          </div>
        )}

        {draft.termsSnapshot && (
          <div className="confirm-block confirm-terms">
            <h3 className="confirm-block__title">規約・注意事項</h3>
            <div className="confirm-terms__text whitespace-pre-wrap">{draft.termsSnapshot}</div>
          </div>
        )}

        <div className="confirm-checks">
          {(draft.checks || []).map((c) => (
            <label key={c.id} className="confirm-check">
              <input
                type="checkbox"
                className="confirm-check__box"
                data-check={c.id}
                checked={checked.includes(c.id)}
                onChange={(e) => toggle(c.id, e.target.checked)}
              />
              <span className="confirm-check__text">{c.label}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="confirm-actions no-print">
        <Link href={`/form/${encodeURIComponent(draft.templateId)}`} className="btn btn--ghost">
          ← 入力に戻る
        </Link>
        <button id="toSign" type="button" className="btn btn--primary btn--lg" onClick={toSign}>
          サイン欄へ進む →
        </button>
      </div>
      <p id="confirmError" className="form-error mx-auto max-w-[820px]">
        {error}
      </p>
    </div>
  );
}

// 「ラベル：値」1行ぶん
function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="confirm-row">
      <div className="confirm-row__label">{label}</div>
      <div className="confirm-row__value">{value}</div>
    </div>
  );
}
