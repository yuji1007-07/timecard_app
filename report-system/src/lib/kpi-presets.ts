// 各業態のKPIテンプレート（ユーザー提供）。大枠カテゴリでグループ化。/api/load-kpi で一括投入する。
// 会員種別ごとに繰り返す項目は接頭辞（定額- / 新定額- / プレミアム- / ダイエット-）で区別。

export type KpiPresetGroup = { category: string; names: string[] };
export type KpiPreset = { businessType: string; groups: KpiPresetGroup[] };

const SEIKOTSU: KpiPreset = {
  businessType: "SEIKOTSU",
  groups: [
    { category: "KPI", names: ["総売上", "日割り", "総カルテ枚数", "通院頻度", "窓口単価", "総来院数"] },
    {
      category: "売上詳細",
      names: [
        "保険請求", "保険窓口収入", "労災", "自費", "月会費", "月会費継続", "会員退入会金",
        "HV", "HV月会費", "HV継続", "骨盤矯正", "フットケア", "楽トレ",
        "自賠責(発生ベース)", "労災・人身傷害保険（健保含）", "サプリ", "物販", "プリカ", "プリカ消費",
      ],
    },
    { category: "新規・成約・離反", names: ["初診数", "再診数", "成約数", "成約率", "離反数", "離反率"] },
    { category: "会員", names: ["会員-カルテ枚数", "会員-平均通院回数", "会員-平均窓口単価", "会員入会数", "会員離反数", "会員休会数"] },
    { category: "骨盤", names: ["骨盤-カルテ枚数", "骨盤-平均通院回数", "骨盤-平均窓口単価"] },
    { category: "自賠責", names: ["自賠責-カルテ枚数", "自賠責-平均通院回数", "自賠責-平均窓口単価"] },
  ],
};

const memberDetail = (prefix: string, totalLabel = "総来院数"): string[] => [
  `${prefix}-入会数`,
  `${prefix}-退会数`,
  `${prefix}-${totalLabel}`,
  `${prefix}-平均来店頻度`,
  `${prefix}-平均窓口単価/回`,
  `${prefix}-月単価`,
  `${prefix}-平均来店単価/回（P込）`,
  `${prefix}-月単価（P込）`,
  `${prefix}-項目売上`,
];

const memberDetailEsthe = (prefix: string, totalLabel = "総来院数"): string[] => [
  `${prefix}-入会数`,
  `${prefix}-退会数`,
  `${prefix}-休会者数`,
  `${prefix}-幽霊会員数`,
  `${prefix}-${totalLabel}`,
  `${prefix}-平均来店頻度`,
  `${prefix}-平均窓口単価/回`,
  `${prefix}-月単価`,
  `${prefix}-平均来店単価/回（P込）`,
  `${prefix}-月単価（P込）`,
  `${prefix}-項目売上`,
];

const SHINKYU: KpiPreset = {
  businessType: "SHINKYU",
  groups: [
    { category: "予算", names: ["予測着地", "営業日数"] },
    { category: "KPI", names: ["日割り業績", "カルテ枚数", "通院頻度", "窓口単価", "総来院数"] },
    {
      category: "予算詳細",
      names: [
        "ビジター（クーポン）", "新規契約売上", "継続定額（旧料金）", "継続定額（新定額）", "プレミアムコース",
        "物販", "その他　回数券", "オレア", "プリカ", "鍼灸治療", "鍼ボンバー",
      ],
    },
    {
      category: "会員数・新規",
      names: [
        "定額会員数", "プレミアム会員数", "鍼ボンバー定額会員数", "ラコンシェル定額会員数", "回数券のみ",
        "新定額会員", "新規数", "契約数", "契約率", "口コミ", "CP実施数", "CPポイント消化数",
      ],
    },
    { category: "定額会員", names: memberDetail("定額") },
    { category: "新定額会員", names: memberDetail("新定額") },
    { category: "プレミアム会員", names: memberDetail("プレミアム", "総来店数") },
  ],
};

const ESTHE: KpiPreset = {
  businessType: "ESTHE",
  groups: [
    { category: "予算", names: ["実績（予測）", "営業日数"] },
    { category: "KPI", names: ["日割り業績", "カルテ枚数", "来店頻度", "単価(1回あたり)", "総来店数"] },
    {
      category: "予算詳細",
      names: [
        "ビジター（クーポン）", "新規契約売上", "ダイエットコース", "継続定額（新定額）", "プレミアムコース",
        "物販", "その他　回数券", "プリカ", "腸もみ", "プリカ消費",
      ],
    },
    {
      category: "会員数・新規",
      names: [
        "ダイエットコース会員数", "新定額会員", "プレミアム会員数", "腸もみ会員数", "回数券のみ", "非契約顧客",
        "新規数", "契約数", "契約率", "離反者数", "離反率", "幽霊会員", "口コミ", "CPポイント消化数",
      ],
    },
    { category: "ダイエットコース", names: memberDetailEsthe("ダイエット") },
    { category: "新定額会員", names: memberDetailEsthe("新定額") },
    { category: "プレミアム会員", names: memberDetailEsthe("プレミアム", "総来店数") },
  ],
};

export const KPI_PRESETS: KpiPreset[] = [SEIKOTSU, SHINKYU, ESTHE];
