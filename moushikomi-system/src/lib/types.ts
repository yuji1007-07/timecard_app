// 申込書テンプレート・申込データの型（旧アプリの JSON 構造をそのまま使う）

export const FIELD_TYPES = ["text", "tel", "date", "textarea", "select", "checkboxes"] as const;
export type FieldType = (typeof FIELD_TYPES)[number];

export const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  text: "文字",
  tel: "電話",
  date: "日付",
  textarea: "複数行",
  select: "選択肢",
  checkboxes: "複数選択",
};

// 入力項目: type は入力の種類 text=文字 / tel=電話 / date=日付 / textarea=複数行 / select=選択肢 / checkboxes=複数選択
export type TemplateField = {
  id: string;
  label: string;
  type: FieldType;
  required: boolean;
  placeholder?: string;
  options?: string[];
};

// 確認チェック項目
export type TemplateCheck = { id: string; label: string };

// プラン（プラン名・月額・初回費用）
export type TemplatePlan = { id: string; name: string; monthlyFee: string; initialFee: string };

export type TemplateData = {
  id: string;
  name: string;
  category: string;
  departments: string[]; // 対象部門（空 = 全部門共通）
  bodyText: string;
  fields: TemplateField[];
  checks: TemplateCheck[];
  plans: TemplatePlan[];
  terms: string;
  createdAt?: string;
  updatedAt?: string;
};

// 申込書1件ぶん（下書き・保存済みの両方で同じ形）
export type ApplicationData = {
  id: string;
  templateId: string;
  templateName: string;
  category: string;
  bodySnapshot: string;
  termsSnapshot: string;
  checks: TemplateCheck[];
  fields: TemplateField[];
  applyDate: string;
  storeId: string;
  storeName: string;
  department: string;
  staffName: string;
  fieldValues: Record<string, string>;
  planId: string;
  planName: string;
  monthlyFee: string;
  initialFee: string;
  checkedItems: string[];
  signatureDataUrl: string;
  createdAt?: string;
};

/** 一覧表示用（署名画像を含まない軽量版） */
export type ApplicationListItem = Omit<ApplicationData, "signatureDataUrl" | "bodySnapshot" | "termsSnapshot" | "checks">;

// ------- ID生成（旧アプリの newId と同じ形式） -------
export function newId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// ------- JSON カラムを安全に型へ変換する -------
function asArray<T>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}

export function normalizeFields(v: unknown): TemplateField[] {
  return asArray<Partial<TemplateField>>(v)
    .filter((f) => f && typeof f === "object")
    .map((f) => ({
      id: String(f.id ?? newId()),
      label: String(f.label ?? ""),
      type: (FIELD_TYPES as readonly string[]).includes(String(f.type)) ? (f.type as FieldType) : "text",
      required: !!f.required,
      placeholder: f.placeholder ? String(f.placeholder) : "",
      options: Array.isArray(f.options) ? f.options.map(String) : undefined,
    }));
}

export function normalizeChecks(v: unknown): TemplateCheck[] {
  return asArray<Partial<TemplateCheck>>(v)
    .filter((c) => c && typeof c === "object")
    .map((c) => ({ id: String(c.id ?? newId()), label: String(c.label ?? "") }));
}

export function normalizePlans(v: unknown): TemplatePlan[] {
  return asArray<Partial<TemplatePlan>>(v)
    .filter((p) => p && typeof p === "object")
    .map((p) => ({
      id: String(p.id ?? newId()),
      name: String(p.name ?? ""),
      monthlyFee: String(p.monthlyFee ?? ""),
      initialFee: String(p.initialFee ?? ""),
    }));
}

export function normalizeStringArray(v: unknown): string[] {
  return asArray<unknown>(v).map(String).filter(Boolean);
}

export function normalizeFieldValues(v: unknown): Record<string, string> {
  if (!v || typeof v !== "object" || Array.isArray(v)) return {};
  const out: Record<string, string> = {};
  for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
    out[k] = val === null || val === undefined ? "" : String(val);
  }
  return out;
}

/** Prisma の Template 行を TemplateData に変換 */
export function toTemplateData(t: {
  id: string;
  name: string;
  category: string;
  departments: unknown;
  bodyText: string;
  fields: unknown;
  checks: unknown;
  plans: unknown;
  terms: string;
  createdAt: Date;
  updatedAt: Date;
}): TemplateData {
  return {
    id: t.id,
    name: t.name,
    category: t.category,
    departments: normalizeStringArray(t.departments),
    bodyText: t.bodyText,
    fields: normalizeFields(t.fields),
    checks: normalizeChecks(t.checks),
    plans: normalizePlans(t.plans),
    terms: t.terms,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  };
}

/** Prisma の Application 行を ApplicationData に変換 */
export function toApplicationData(a: {
  id: string;
  templateId: string;
  templateName: string;
  category: string;
  bodySnapshot: string;
  termsSnapshot: string;
  checks: unknown;
  fields: unknown;
  applyDate: string;
  storeId: string;
  storeName: string;
  department: string;
  staffName: string;
  fieldValues: unknown;
  planId: string;
  planName: string;
  monthlyFee: string;
  initialFee: string;
  checkedItems: unknown;
  signatureDataUrl: string;
  createdAt: Date;
}): ApplicationData {
  return {
    id: a.id,
    templateId: a.templateId,
    templateName: a.templateName,
    category: a.category,
    bodySnapshot: a.bodySnapshot,
    termsSnapshot: a.termsSnapshot,
    checks: normalizeChecks(a.checks),
    fields: normalizeFields(a.fields),
    applyDate: a.applyDate,
    storeId: a.storeId,
    storeName: a.storeName,
    department: a.department,
    staffName: a.staffName,
    fieldValues: normalizeFieldValues(a.fieldValues),
    planId: a.planId,
    planName: a.planName,
    monthlyFee: a.monthlyFee,
    initialFee: a.initialFee,
    checkedItems: normalizeStringArray(a.checkedItems),
    signatureDataUrl: a.signatureDataUrl,
    createdAt: a.createdAt.toISOString(),
  };
}

/** 一覧用（署名画像などを除いた軽量版） */
export function toApplicationListItem(a: {
  id: string;
  templateId: string;
  templateName: string;
  category: string;
  fields: unknown;
  applyDate: string;
  storeId: string;
  storeName: string;
  department: string;
  staffName: string;
  fieldValues: unknown;
  planId: string;
  planName: string;
  monthlyFee: string;
  initialFee: string;
  checkedItems: unknown;
  createdAt: Date;
}): ApplicationListItem {
  return {
    id: a.id,
    templateId: a.templateId,
    templateName: a.templateName,
    category: a.category,
    fields: normalizeFields(a.fields),
    applyDate: a.applyDate,
    storeId: a.storeId,
    storeName: a.storeName,
    department: a.department,
    staffName: a.staffName,
    fieldValues: normalizeFieldValues(a.fieldValues),
    planId: a.planId,
    planName: a.planName,
    monthlyFee: a.monthlyFee,
    initialFee: a.initialFee,
    checkedItems: normalizeStringArray(a.checkedItems),
    createdAt: a.createdAt.toISOString(),
  };
}

/** テンプレートがこの部門で表示対象か判定する（departments が空 = 全部門共通） */
export function visibleForDept(t: { departments: string[] }, dept: string): boolean {
  const ds = t.departments || [];
  if (ds.length === 0) return true;
  return ds.includes(dept);
}

// ------- 申込データから特定の項目値を取り出す（旧アプリと同じ） -------
export function fieldVal(app: { fields: TemplateField[]; fieldValues: Record<string, string> }, keyword: string): string {
  const f = (app.fields || []).find((x) => x.label.includes(keyword));
  return f ? app.fieldValues[f.id] || "" : "";
}

/** 氏名らしき項目を探して返す（「氏名」または「名前」を含むラベルの値） */
export function patientName(app: { fields: TemplateField[]; fieldValues: Record<string, string> }, fallback = "（無記名）"): string {
  const f = (app.fields || []).find((x) => x.label.includes("氏名") || x.label.includes("名前"));
  return f ? app.fieldValues[f.id] || fallback : fallback;
}
