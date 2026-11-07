"use client";

// テンプレート編集画面（旧アプリ templateEdit.js の移植）
// テンプレート名・本文・入力項目・チェック項目・プラン・規約を編集します。
// 入力項目は「追加 / 削除 / 並び替え（↑↓）」ができます。
// 編集中のデータは model（React の state）に保持します。

import { useActionState, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DEPARTMENTS } from "@/lib/constants";
import { FIELD_TYPES, FIELD_TYPE_LABELS, newId, type FieldType, type TemplateData, type TemplateField } from "@/lib/types";
import { saveTemplate } from "../actions";

export function TemplateEditor({ initial, isNew }: { initial: TemplateData; isNew: boolean }) {
  const router = useRouter();
  const [model, setModel] = useState<TemplateData>(initial);
  const [error, setError] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  const jsonRef = useRef<HTMLInputElement>(null);
  const [state, action, pending] = useActionState(saveTemplate, null);

  useEffect(() => {
    if (state?.ok) {
      router.push("/templates");
      router.refresh();
    } else if (state && !state.ok) {
      setError(state.message);
    }
  }, [state, router]);

  const update = (patch: Partial<TemplateData>) => setModel((m) => ({ ...m, ...patch }));

  function updateField(id: string, patch: Partial<TemplateField>) {
    setModel((m) => ({ ...m, fields: m.fields.map((f) => (f.id === id ? { ...f, ...patch } : f)) }));
  }
  // 項目を1つ上(-1)または下(+1)に移動する
  function moveField(id: string, dir: -1 | 1) {
    setModel((m) => {
      const fields = [...m.fields];
      const i = fields.findIndex((f) => f.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= fields.length) return m;
      [fields[i], fields[j]] = [fields[j], fields[i]];
      return { ...m, fields };
    });
  }
  function toggleDept(d: string, on: boolean) {
    setModel((m) => ({ ...m, departments: on ? [...m.departments.filter((x) => x !== d), d] : m.departments.filter((x) => x !== d) }));
  }

  // 保存
  function save() {
    if (!model.name.trim()) {
      setError("テンプレート名は必須です。");
      return;
    }
    setError("");
    if (jsonRef.current) jsonRef.current.value = JSON.stringify(model);
    formRef.current?.requestSubmit();
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-navy md:text-2xl">{isNew ? "新規テンプレート作成" : "テンプレート編集"}</h1>
        <Link href="/templates" prefetch={false} className="btn btn--ghost btn--small">
          一覧へ戻る
        </Link>
      </div>

      <div className="form-card">
        <div className="form-section">
          <h2 className="form-section__title">基本</h2>
          <div className="field">
            <label className="field__label" htmlFor="tName">
              テンプレート名 <span className="field__req">必須</span>
            </label>
            <input id="tName" className="field__input" type="text" value={model.name} onChange={(e) => update({ name: e.target.value })} placeholder="例: 整骨院 会員入会申込書" />
          </div>
          <div className="field">
            <label className="field__label" htmlFor="tCategory">
              種類（カテゴリ）
            </label>
            <input id="tCategory" className="field__input" type="text" value={model.category} onChange={(e) => update({ category: e.target.value })} placeholder="例: 整骨院 / 鍼灸 / エステ / 回数券 / 同意書" />
          </div>
          <div className="field">
            <label className="field__label">対象部門（この申込書を使える部門）</label>
            <div className="dept-toggles">
              {DEPARTMENTS.map((d) => (
                <label key={d} className="dept-toggle">
                  <input type="checkbox" className="dept-check" value={d} checked={model.departments.includes(d)} onChange={(e) => toggleDept(d, e.target.checked)} />
                  <span>{d}</span>
                </label>
              ))}
            </div>
            <p className="field__hint">
              ボタンを押すとオン／オフが切り替わります。どれもオフの場合は「全部門で表示（共通）」になります。店舗ログインでは、その店舗の部門に合った申込書だけが表示されます。
            </p>
          </div>
          <div className="field">
            <label className="field__label" htmlFor="tBody">
              本文（冒頭の説明）
            </label>
            <textarea id="tBody" className="field__input" rows={3} value={model.bodyText} onChange={(e) => update({ bodyText: e.target.value })} placeholder="申込書の最初に表示する説明文" />
          </div>
        </div>

        <div className="form-section">
          <div className="section-head">
            <h2 className="form-section__title">入力項目</h2>
            <button
              id="addField"
              type="button"
              className="btn btn--small btn--primary"
              onClick={() => update({ fields: [...model.fields, { id: newId(), label: "", type: "text", required: false, placeholder: "" }] })}
            >
              ＋ 項目を追加
            </button>
          </div>
          <div id="fieldList">
            {model.fields.length === 0 && <p className="muted">項目がありません。</p>}
            {model.fields.map((f, i) => (
              <div key={f.id} className="edit-row">
                <div className="edit-row__order">
                  <button type="button" className="icon-btn" data-up={f.id} disabled={i === 0} onClick={() => moveField(f.id, -1)}>
                    ↑
                  </button>
                  <button type="button" className="icon-btn" data-down={f.id} disabled={i === model.fields.length - 1} onClick={() => moveField(f.id, 1)}>
                    ↓
                  </button>
                </div>
                <input id={`fl_${f.id}`} className="field__input edit-row__main" type="text" value={f.label} onChange={(e) => updateField(f.id, { label: e.target.value })} placeholder="項目名" />
                <select id={`ft_${f.id}`} className="field__input edit-row__type" value={f.type} onChange={(e) => updateField(f.id, { type: e.target.value as FieldType })}>
                  {FIELD_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {FIELD_TYPE_LABELS[t]}
                    </option>
                  ))}
                </select>
                <input id={`fp_${f.id}`} className="field__input edit-row__ph" type="text" value={f.placeholder || ""} onChange={(e) => updateField(f.id, { placeholder: e.target.value })} placeholder="入力例" />
                <label className="edit-row__req">
                  <input id={`fr_${f.id}`} type="checkbox" checked={f.required} onChange={(e) => updateField(f.id, { required: e.target.checked })} /> 必須
                </label>
                <button type="button" className="icon-btn icon-btn--danger" data-delfield={f.id} onClick={() => update({ fields: model.fields.filter((x) => x.id !== f.id) })}>
                  ✕
                </button>
                {(f.type === "select" || f.type === "checkboxes") && (
                  <textarea
                    id={`fo_${f.id}`}
                    className="field__input edit-row__options"
                    rows={3}
                    placeholder="選択肢を1行に1つ書いてください"
                    defaultValue={(f.options || []).join("\n")}
                    onChange={(e) =>
                      updateField(f.id, {
                        options: e.target.value
                          .split("\n")
                          .map((s) => s.trim())
                          .filter((s) => s),
                      })
                    }
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="form-section">
          <div className="section-head">
            <h2 className="form-section__title">確認チェック項目</h2>
            <button id="addCheck" type="button" className="btn btn--small btn--primary" onClick={() => update({ checks: [...model.checks, { id: newId(), label: "" }] })}>
              ＋ チェックを追加
            </button>
          </div>
          <div id="checkList">
            {model.checks.length === 0 && <p className="muted">チェック項目がありません。</p>}
            {model.checks.map((c) => (
              <div key={c.id} className="edit-row">
                <input
                  id={`cl_${c.id}`}
                  className="field__input edit-row__main"
                  type="text"
                  value={c.label}
                  onChange={(e) => update({ checks: model.checks.map((x) => (x.id === c.id ? { ...x, label: e.target.value } : x)) })}
                  placeholder="確認文（例: 上記内容を確認しました）"
                />
                <button type="button" className="icon-btn icon-btn--danger" data-delcheck={c.id} onClick={() => update({ checks: model.checks.filter((x) => x.id !== c.id) })}>
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="form-section">
          <div className="section-head">
            <h2 className="form-section__title">プラン・料金</h2>
            <button
              id="addPlan"
              type="button"
              className="btn btn--small btn--primary"
              onClick={() => update({ plans: [...model.plans, { id: newId(), name: "", monthlyFee: "", initialFee: "" }] })}
            >
              ＋ プランを追加
            </button>
          </div>
          <div id="planList">
            {model.plans.length === 0 && <p className="muted">プランがありません（任意）。</p>}
            {model.plans.map((p) => {
              const up = (patch: Partial<typeof p>) => update({ plans: model.plans.map((x) => (x.id === p.id ? { ...x, ...patch } : x)) });
              return (
                <div key={p.id} className="edit-row">
                  <input id={`pn_${p.id}`} className="field__input edit-row__main" type="text" value={p.name} onChange={(e) => up({ name: e.target.value })} placeholder="プラン名" />
                  <input id={`pm_${p.id}`} className="field__input edit-row__fee" type="text" value={p.monthlyFee} onChange={(e) => up({ monthlyFee: e.target.value })} placeholder="月額" />
                  <input id={`pi_${p.id}`} className="field__input edit-row__fee" type="text" value={p.initialFee} onChange={(e) => up({ initialFee: e.target.value })} placeholder="初回費用" />
                  <button type="button" className="icon-btn icon-btn--danger" data-delplan={p.id} onClick={() => update({ plans: model.plans.filter((x) => x.id !== p.id) })}>
                    ✕
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        <div className="form-section">
          <h2 className="form-section__title">規約・注意事項</h2>
          <textarea id="tTerms" className="field__input" rows={6} value={model.terms} onChange={(e) => update({ terms: e.target.value })} placeholder="規約や注意事項を記入" />
        </div>

        <form ref={formRef} action={action} className="hidden">
          <input ref={jsonRef} type="hidden" name="json" defaultValue="" />
        </form>

        <div className="form-actions">
          <Link href="/templates" prefetch={false} className="btn btn--ghost">
            キャンセル
          </Link>
          <button id="saveBtn" type="button" className="btn btn--primary btn--lg" onClick={save} disabled={pending}>
            {pending ? "保存中…" : "保存する"}
          </button>
        </div>
        <p id="editError" className="form-error">
          {error}
        </p>
      </div>
    </div>
  );
}
