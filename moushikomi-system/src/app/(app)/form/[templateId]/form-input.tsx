"use client";

// 申込内容入力画面（旧アプリ formInput.js の移植）
// スタッフが患者様の情報を入力します。入力内容は「下書き」として端末に保存し、確認画面に渡します。

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getDraft, setDraft } from "@/lib/draft";
import { todayStr } from "@/lib/format";
import { newId, type ApplicationData, type TemplateData } from "@/lib/types";

type StoreOpt = { id: string; name: string; department: string };

export function FormInput({
  template,
  stores,
  lockedStore,
}: {
  template: TemplateData;
  stores: StoreOpt[];
  lockedStore: StoreOpt | null;
}) {
  const router = useRouter();
  const [prev, setPrev] = useState<ApplicationData | null>(null);
  const [loaded, setLoaded] = useState(false);

  const [applyDate, setApplyDate] = useState("");
  const [storeId, setStoreId] = useState(lockedStore?.id ?? "");
  const [staffName, setStaffName] = useState("");
  const [values, setValues] = useState<Record<string, string>>({});
  const [checkboxSel, setCheckboxSel] = useState<Record<string, string[]>>({});
  const [planId, setPlanId] = useState("");
  const [monthlyFee, setMonthlyFee] = useState("");
  const [initialFee, setInitialFee] = useState("");
  const [error, setError] = useState("");

  // 同じテンプレートの入力途中があれば引き継ぐ（戻ってきた時用）
  useEffect(() => {
    const d = getDraft();
    const p = d && d.templateId === template.id ? d : null;
    setPrev(p);
    setApplyDate(p ? p.applyDate : todayStr());
    setStoreId(lockedStore?.id ?? (p ? p.storeId : ""));
    setStaffName(p ? p.staffName : "");
    const v: Record<string, string> = {};
    const cs: Record<string, string[]> = {};
    for (const f of template.fields) {
      const raw = p && p.fieldValues ? p.fieldValues[f.id] || "" : "";
      v[f.id] = raw;
      if (f.type === "checkboxes") cs[f.id] = raw ? raw.split(" / ") : [];
    }
    setValues(v);
    setCheckboxSel(cs);
    setPlanId(p ? p.planId : "");
    setMonthlyFee(p ? p.monthlyFee : "");
    setInitialFee(p ? p.initialFee : "");
    setLoaded(true);
  }, [template, lockedStore]);

  // プランを選んだら料金欄を自動入力（あとから手で直せます）
  function onPlanChange(id: string) {
    setPlanId(id);
    const plan = template.plans.find((p) => p.id === id);
    if (plan) {
      setMonthlyFee(plan.monthlyFee || "");
      setInitialFee(plan.initialFee || "");
    }
  }

  function toggleCheckbox(fieldId: string, option: string, checked: boolean) {
    setCheckboxSel((cur) => {
      const list = cur[fieldId] || [];
      const next = checked ? [...list.filter((o) => o !== option), option] : list.filter((o) => o !== option);
      return { ...cur, [fieldId]: next };
    });
  }

  // 「確認画面へ進む」を押したときの処理
  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const store = lockedStore ?? stores.find((s) => s.id === storeId) ?? null;

    // 必須項目チェック（申込日・店舗・テンプレで必須にした項目）
    if (!applyDate || !store) {
      setError("申込日と店舗名は必須です。");
      return;
    }
    const fieldValues: Record<string, string> = {};
    for (const f of template.fields) {
      let v: string;
      if (f.type === "checkboxes") {
        // チェックされた選択肢を「 / 」でつないで保存（選択肢の並び順を保つ）
        const sel = checkboxSel[f.id] || [];
        v = (f.options || []).filter((o) => sel.includes(o)).join(" / ");
      } else {
        v = (values[f.id] || "").trim();
      }
      fieldValues[f.id] = v;
      if (f.required && !v) {
        setError(`「${f.label}」は必須項目です。`);
        return;
      }
    }

    // 選んだプラン情報
    const plan = planId ? template.plans.find((p) => p.id === planId) : null;

    // 下書きとして保存（確認→サイン→保存まで持ち回る）
    const draft: ApplicationData = {
      id: prev ? prev.id : newId(),
      templateId: template.id,
      templateName: template.name,
      category: template.category,
      bodySnapshot: template.bodyText,
      termsSnapshot: template.terms,
      checks: template.checks, // 確認チェック項目（ラベル）
      fields: template.fields, // 表示用に項目定義も保持
      applyDate,
      storeId: store.id,
      storeName: store.name,
      department: store.department,
      staffName: staffName.trim(),
      fieldValues,
      planId: plan ? plan.id : "",
      planName: plan ? plan.name : "",
      monthlyFee: template.plans.length > 0 ? monthlyFee : "",
      initialFee: template.plans.length > 0 ? initialFee : "",
      checkedItems: prev ? prev.checkedItems || [] : [],
      signatureDataUrl: prev ? prev.signatureDataUrl || "" : "",
    };
    setDraft(draft);
    setError("");
    router.push("/confirm");
  }

  if (!loaded) return <div className="py-12 text-center text-muted-foreground">⏳ 読み込み中…</div>;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-navy md:text-2xl">{template.name}</h1>
        <p className="mt-1 text-sm text-muted-foreground">患者様の情報を入力してください</p>
      </div>

      <form onSubmit={onSubmit} className="form-card" noValidate>
        <div className="form-section">
          <h2 className="form-section__title">基本情報</h2>
          <div className="field-row">
            <div className="field">
              <label className="field__label" htmlFor="applyDate">
                申込日 <span className="field__req">必須</span>
              </label>
              <input id="applyDate" className="field__input" type="date" value={applyDate} onChange={(e) => setApplyDate(e.target.value)} />
            </div>
            <div className="field">
              <label className="field__label" htmlFor="storeName">
                店舗名 <span className="field__req">必須</span>
              </label>
              {lockedStore ? (
                <input id="storeName" className="field__input" type="text" value={lockedStore.name} readOnly />
              ) : (
                <select id="storeName" className="field__input" value={storeId} onChange={(e) => setStoreId(e.target.value)}>
                  <option value="">― 選択 ―</option>
                  {stores.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>
          <div className="field">
            <label className="field__label" htmlFor="staffName">
              担当者名
            </label>
            <input
              id="staffName"
              className="field__input"
              type="text"
              value={staffName}
              onChange={(e) => setStaffName(e.target.value)}
              placeholder="担当スタッフ名"
            />
          </div>
        </div>

        <div className="form-section">
          <h2 className="form-section__title">患者様情報</h2>
          {template.fields.map((f) => {
            const req = f.required ? <span className="field__req">必須</span> : null;
            const val = values[f.id] ?? "";
            const set = (v: string) => setValues((cur) => ({ ...cur, [f.id]: v }));
            let input: React.ReactNode;
            if (f.type === "textarea") {
              input = <textarea id={`f_${f.id}`} className="field__input" rows={3} placeholder={f.placeholder || ""} value={val} onChange={(e) => set(e.target.value)} />;
            } else if (f.type === "select") {
              // プルダウン（1つ選ぶ）
              input = (
                <select id={`f_${f.id}`} className="field__input" value={val} onChange={(e) => set(e.target.value)}>
                  <option value="">― 選択 ―</option>
                  {(f.options || []).map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              );
            } else if (f.type === "checkboxes") {
              // 複数選択（任意・該当するものに全部チェック）
              const sel = checkboxSel[f.id] || [];
              input = (
                <div id={`f_${f.id}`} className="checkbox-group">
                  {(f.options || []).map((o) => (
                    <label key={o} className="cbx">
                      <input type="checkbox" value={o} checked={sel.includes(o)} onChange={(e) => toggleCheckbox(f.id, o, e.target.checked)} /> {o}
                    </label>
                  ))}
                </div>
              );
            } else {
              input = (
                <input
                  id={`f_${f.id}`}
                  className="field__input"
                  type={f.type === "date" || f.type === "tel" ? f.type : "text"}
                  value={val}
                  placeholder={f.placeholder || ""}
                  onChange={(e) => set(e.target.value)}
                />
              );
            }
            return (
              <div key={f.id} className="field">
                <label className="field__label" htmlFor={`f_${f.id}`}>
                  {f.label} {req}
                </label>
                {input}
              </div>
            );
          })}
        </div>

        {(template.plans || []).length > 0 && (
          <div className="form-section">
            <h2 className="form-section__title">申込プラン</h2>
            <div className="field">
              <label className="field__label" htmlFor="plan">
                プランを選択
              </label>
              <select id="plan" className="field__input" value={planId} onChange={(e) => onPlanChange(e.target.value)}>
                <option value="">― 選択してください ―</option>
                {template.plans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}（月額 {p.monthlyFee}円 / 初回 {p.initialFee}円）
                  </option>
                ))}
              </select>
            </div>
            <div className="field-row">
              <div className="field">
                <label className="field__label" htmlFor="monthlyFee">
                  月額料金（円）
                </label>
                <input id="monthlyFee" className="field__input" type="text" value={monthlyFee} onChange={(e) => setMonthlyFee(e.target.value)} placeholder="例: 8,800" />
              </div>
              <div className="field">
                <label className="field__label" htmlFor="initialFee">
                  初回費用（円）
                </label>
                <input id="initialFee" className="field__input" type="text" value={initialFee} onChange={(e) => setInitialFee(e.target.value)} placeholder="例: 3,300" />
              </div>
            </div>
          </div>
        )}

        <div className="form-actions">
          <Link href="/select" className="btn btn--ghost">
            戻る
          </Link>
          <button type="submit" className="btn btn--primary btn--lg">
            確認画面へ進む →
          </button>
        </div>
        <p id="formError" className="form-error">
          {error}
        </p>
      </form>
    </div>
  );
}
