// ============================================================
// seed.js
// 初回起動時に入れておく「初期データ」です。
// ・申込書テンプレートの見本
// ・店舗一覧
// 自由に書き換えてOKです（管理画面からも編集できます）。
// ============================================================

import { newId } from "./storage.js";

// 店舗一覧（受付で選ぶ店舗名）
export const DEFAULT_STORES = [
  "からだラボ駅前整骨院",
  "からだラボ整骨院 たまプラーザ院",
  "からだラボ整骨院 溝の口院",
  "ラコンシェル青葉台店",
  "鍼灸ラコンシェル青葉台店",
];

// 患者情報の標準入力項目（多くの申込書で共通して使うもの）
// type は入力の種類: text=文字 / tel=電話 / date=日付 / textarea=複数行
function patientFields() {
  return [
    { id: newId(), label: "患者氏名", type: "text", required: true, placeholder: "山田 太郎" },
    { id: newId(), label: "フリガナ", type: "text", required: true, placeholder: "ヤマダ タロウ" },
    { id: newId(), label: "生年月日", type: "date", required: false, placeholder: "" },
    { id: newId(), label: "電話番号", type: "tel", required: true, placeholder: "090-1234-5678" },
    { id: newId(), label: "住所", type: "text", required: false, placeholder: "神奈川県横浜市..." },
    { id: newId(), label: "支払い方法", type: "text", required: false, placeholder: "口座振替 / クレジット / 現金" },
    { id: newId(), label: "備考", type: "textarea", required: false, placeholder: "特記事項があれば記入" },
  ];
}

// 規約・注意事項の見本文
const SAMPLE_TERMS = `【ご入会にあたっての注意事項】
1. 本申込書の内容に相違ないことを確認のうえ、ご署名ください。
2. 料金・プラン内容は申込時点のものです。
3. 解約をご希望の場合は、解約希望月の前月末日までに受付までお申し出ください。
4. ご記入いただいた個人情報は、当院でのサービス提供および連絡の目的にのみ使用いたします。`;

// テンプレートを1件作るためのヘルパー
function makeTemplate({ name, category, body, plans, terms, checks }) {
  return {
    id: newId(),
    name: name,
    category: category,            // 整骨院 / 鍼灸 / エステ / 回数券 / 物販 / 同意書 など
    bodyText: body || "",          // 申込書の本文・説明
    fields: patientFields(),       // 入力項目
    plans: plans || [],            // プラン（プラン名・月額・初回費用）
    checks: checks || [           // 確認チェック項目
      { id: newId(), label: "上記の内容を確認し、相違ないことを確認しました" },
    ],
    terms: terms || SAMPLE_TERMS,  // 規約・注意事項
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

// 初期テンプレート一覧を返す関数
// （関数にしているのは、呼ばれるたびに新しいIDで作り直すためです）
export function DEFAULT_TEMPLATES() {
  return [
    makeTemplate({
      name: "整骨院 会員入会申込書",
      category: "整骨院",
      body: "このたびは当院の会員制プランにお申し込みいただき、誠にありがとうございます。以下の内容をご確認ください。",
      plans: [
        { id: newId(), name: "月4回コース", monthlyFee: "8,800", initialFee: "3,300" },
        { id: newId(), name: "月8回コース", monthlyFee: "15,400", initialFee: "3,300" },
        { id: newId(), name: "通い放題コース", monthlyFee: "19,800", initialFee: "3,300" },
      ],
    }),
    makeTemplate({
      name: "鍼灸 会員入会申込書",
      category: "鍼灸",
      body: "鍼灸メンテナンス会員プランのお申し込みです。施術内容・料金をご確認ください。",
      plans: [
        { id: newId(), name: "月2回コース", monthlyFee: "12,000", initialFee: "5,500" },
        { id: newId(), name: "月4回コース", monthlyFee: "22,000", initialFee: "5,500" },
      ],
    }),
    makeTemplate({
      name: "エステ 会員入会申込書",
      category: "エステ",
      body: "美容エステ会員プランのお申し込みです。",
      plans: [
        { id: newId(), name: "フェイシャル月2回", monthlyFee: "16,500", initialFee: "0" },
        { id: newId(), name: "ボディ月2回", monthlyFee: "19,800", initialFee: "0" },
      ],
    }),
    makeTemplate({
      name: "回数券 申込書",
      category: "回数券",
      body: "回数券のお申し込みです。有効期限・利用条件をご確認ください。",
      plans: [
        { id: newId(), name: "5回券", monthlyFee: "0", initialFee: "16,500" },
        { id: newId(), name: "10回券", monthlyFee: "0", initialFee: "30,000" },
      ],
      terms:
        "【回数券について】\n1. 有効期限は購入日から6ヶ月です。\n2. 払い戻しはできません。\n3. ご本人様のみ利用可能です。",
    }),
    makeTemplate({
      name: "物販 定期購入申込書",
      category: "物販",
      body: "サプリメント・物販品の定期購入のお申し込みです。",
      plans: [
        { id: newId(), name: "サプリ毎月コース", monthlyFee: "5,400", initialFee: "0" },
      ],
    }),
    makeTemplate({
      name: "同意書",
      category: "同意書",
      body: "施術を受けるにあたっての同意事項です。内容をご確認のうえご署名ください。",
      plans: [],
      checks: [
        { id: newId(), label: "施術内容・リスクについて説明を受け、理解しました" },
        { id: newId(), label: "上記の内容に同意します" },
      ],
      terms:
        "【施術同意事項】\n1. 施術により好転反応（だるさ・もみ返し等）が出る場合があります。\n2. 持病・既往歴は事前に必ずお申し出ください。\n3. 妊娠中の方は事前にお知らせください。",
    }),
  ];
}
