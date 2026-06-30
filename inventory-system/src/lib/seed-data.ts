// 初期投入データ（店舗・ブランド・カテゴリ・代表商品）

export const SEED_STORES: {
  name: string;
  businessType: string;
  isHeadquarters?: boolean;
  directorName?: string;
  pin?: string;
}[] = [
  // 整骨院・鍼灸（複合含む）
  { name: "青葉台駅前院", businessType: "SEIKOTSU", pin: "1001" },
  { name: "桜台院", businessType: "SEIKOTSU", pin: "1002" },
  { name: "溝の口本院", businessType: "COMPLEX", pin: "1003" },
  { name: "溝の口分院", businessType: "SEIKOTSU", pin: "1004" },
  { name: "新百合ヶ丘北口院", businessType: "SEIKOTSU", pin: "1005" },
  { name: "マプレ院", businessType: "SEIKOTSU", pin: "1006" },
  { name: "狛江院", businessType: "SEIKOTSU", pin: "1007" },
  { name: "駒沢大学駅院", businessType: "SEIKOTSU", pin: "1008" },
  { name: "たまプラーザ院", businessType: "SEIKOTSU", pin: "1009" },
  { name: "センター北院", businessType: "SEIKOTSU", pin: "1010" },
  { name: "用賀院", businessType: "SEIKOTSU", pin: "1011" },
  { name: "武蔵小杉院", businessType: "SEIKOTSU", pin: "1012" },
  { name: "向ヶ丘遊園院", businessType: "SEIKOTSU", pin: "1013" },
  // エステ
  { name: "エステ青葉台店", businessType: "ESTHE", pin: "2001" },
  { name: "エステ溝の口店", businessType: "ESTHE", pin: "2002" },
  { name: "エステ三軒茶屋店", businessType: "ESTHE", pin: "2003" },
  { name: "エステ町田店", businessType: "ESTHE", pin: "2004" },
  // 鍼灸
  { name: "鍼灸代々木上原店", businessType: "SHINKYU", pin: "3001" },
  { name: "鍼灸町田店", businessType: "SHINKYU", pin: "3002" },
  { name: "鍼灸たまプラーザ店", businessType: "SHINKYU", pin: "3003" },
  { name: "鍼灸武蔵小杉店", businessType: "SHINKYU", pin: "3004" },
];

export const SEED_BRANDS: { name: string; colorHex: string }[] = [
  { name: "ReD", colorHex: "#dc2626" },
  { name: "ReFa", colorHex: "#0ea5e9" },
  { name: "NEWPEACE", colorHex: "#7c3aed" },
  { name: "SIXPAD", colorHex: "#111827" },
  { name: "オレアプレミアム", colorHex: "#ca8a04" },
  { name: "UTP", colorHex: "#0891b2" },
  { name: "プロラボ", colorHex: "#16a34a" },
  { name: "ミラクルバスト", colorHex: "#db2777" },
  { name: "マイデンシ", colorHex: "#2563eb" },
  { name: "コーケン", colorHex: "#64748b" },
  { name: "KGジャパン", colorHex: "#ea580c" },
];

export const SEED_CATEGORIES = ["ウェア", "ヘアケア", "美容機器", "サプリ", "化粧品", "備品"];

// 代表商品（CSVインポートで残りを足せる構成）。
// priceMode は税抜/税込/両方のサンプルを混在させ自動計算を確認できるようにする。
export type SeedProduct = {
  brand: string;
  name: string;
  category: string;
  normalExcl: number;
  normalIncl: number;
  wholesaleExcl: number;
  wholesaleIncl: number;
  taxRate: number;
  unit: string;
  minStock: number;
  priceModeNormal?: "EXCL" | "INCL" | "BOTH";
  priceModeWholesale?: "EXCL" | "INCL" | "BOTH";
};

export const SEED_PRODUCTS: SeedProduct[] = [
  // ReD（ウェア中心。税抜入力モード）
  { brand: "ReD", name: "ReD コンプレッションウェア M", category: "ウェア", normalExcl: 12000, normalIncl: 0, wholesaleExcl: 6000, wholesaleIncl: 0, taxRate: 10, unit: "着", minStock: 3, priceModeNormal: "EXCL", priceModeWholesale: "EXCL" },
  { brand: "ReD", name: "ReD コンプレッションウェア L", category: "ウェア", normalExcl: 12000, normalIncl: 0, wholesaleExcl: 6000, wholesaleIncl: 0, taxRate: 10, unit: "着", minStock: 3, priceModeNormal: "EXCL", priceModeWholesale: "EXCL" },
  { brand: "ReD", name: "ReD レギンス", category: "ウェア", normalExcl: 9000, normalIncl: 0, wholesaleExcl: 4500, wholesaleIncl: 0, taxRate: 10, unit: "本", minStock: 2, priceModeNormal: "EXCL", priceModeWholesale: "EXCL" },
  // ReFa（美容機器。税込入力モード）
  { brand: "ReFa", name: "ReFa カラット", category: "美容機器", normalExcl: 0, normalIncl: 26980, wholesaleExcl: 0, wholesaleIncl: 16000, taxRate: 10, unit: "個", minStock: 2, priceModeNormal: "INCL", priceModeWholesale: "INCL" },
  { brand: "ReFa", name: "ReFa ファインバブル S", category: "美容機器", normalExcl: 0, normalIncl: 30000, wholesaleExcl: 0, wholesaleIncl: 18000, taxRate: 10, unit: "個", minStock: 2, priceModeNormal: "INCL", priceModeWholesale: "INCL" },
  { brand: "ReFa", name: "ReFa ヘアシャンプー", category: "ヘアケア", normalExcl: 0, normalIncl: 3300, wholesaleExcl: 0, wholesaleIncl: 1800, taxRate: 10, unit: "本", minStock: 5, priceModeNormal: "INCL", priceModeWholesale: "INCL" },
  { brand: "ReFa", name: "ReFa ヘアトリートメント", category: "ヘアケア", normalExcl: 0, normalIncl: 3300, wholesaleExcl: 0, wholesaleIncl: 1800, taxRate: 10, unit: "本", minStock: 5, priceModeNormal: "INCL", priceModeWholesale: "INCL" },
  // NEWPEACE（美容機器）
  { brand: "NEWPEACE", name: "NEWPEACE Recovery Wear トップス", category: "ウェア", normalExcl: 0, normalIncl: 19800, wholesaleExcl: 0, wholesaleIncl: 11000, taxRate: 10, unit: "着", minStock: 2, priceModeNormal: "INCL", priceModeWholesale: "INCL" },
  { brand: "NEWPEACE", name: "NEWPEACE Recovery Wear ボトムス", category: "ウェア", normalExcl: 0, normalIncl: 19800, wholesaleExcl: 0, wholesaleIncl: 11000, taxRate: 10, unit: "本", minStock: 2, priceModeNormal: "INCL", priceModeWholesale: "INCL" },
  { brand: "NEWPEACE", name: "NEWPEACE Pillow Release", category: "備品", normalExcl: 0, normalIncl: 16500, wholesaleExcl: 0, wholesaleIncl: 9000, taxRate: 10, unit: "個", minStock: 2, priceModeNormal: "INCL", priceModeWholesale: "INCL" },
  // SIXPAD（美容機器）
  { brand: "SIXPAD", name: "SIXPAD Powersuit Lite 腹部", category: "美容機器", normalExcl: 0, normalIncl: 27500, wholesaleExcl: 0, wholesaleIncl: 16500, taxRate: 10, unit: "個", minStock: 1, priceModeNormal: "INCL", priceModeWholesale: "INCL" },
  { brand: "SIXPAD", name: "SIXPAD Foot Fit", category: "美容機器", normalExcl: 0, normalIncl: 46800, wholesaleExcl: 0, wholesaleIncl: 28000, taxRate: 10, unit: "個", minStock: 1, priceModeNormal: "INCL", priceModeWholesale: "INCL" },
  { brand: "SIXPAD", name: "SIXPAD 高電導ジェルシート", category: "備品", normalExcl: 0, normalIncl: 3960, wholesaleExcl: 0, wholesaleIncl: 2200, taxRate: 10, unit: "箱", minStock: 6, priceModeNormal: "INCL", priceModeWholesale: "INCL" },
  // オレアプレミアム（化粧品。両方入力）
  { brand: "オレアプレミアム", name: "オレアプレミアム フェイスクリーム", category: "化粧品", normalExcl: 8000, normalIncl: 8800, wholesaleExcl: 4000, wholesaleIncl: 4400, taxRate: 10, unit: "個", minStock: 4 },
  { brand: "オレアプレミアム", name: "オレアプレミアム 美容オイル", category: "化粧品", normalExcl: 6000, normalIncl: 6600, wholesaleExcl: 3000, wholesaleIncl: 3300, taxRate: 10, unit: "本", minStock: 4 },
  // UTP
  { brand: "UTP", name: "UTP ボディクリーム", category: "化粧品", normalExcl: 5000, normalIncl: 5500, wholesaleExcl: 2500, wholesaleIncl: 2750, taxRate: 10, unit: "個", minStock: 5 },
  { brand: "UTP", name: "UTP マッサージジェル", category: "備品", normalExcl: 3000, normalIncl: 3300, wholesaleExcl: 1500, wholesaleIncl: 1650, taxRate: 10, unit: "本", minStock: 8 },
  // プロラボ（サプリ。8%軽減税率）
  { brand: "プロラボ", name: "プロラボ 美容ドリンク", category: "サプリ", normalExcl: 0, normalIncl: 5400, wholesaleExcl: 0, wholesaleIncl: 2900, taxRate: 8, unit: "箱", minStock: 6, priceModeNormal: "INCL", priceModeWholesale: "INCL" },
  { brand: "プロラボ", name: "プロラボ 酵素ドリンク", category: "サプリ", normalExcl: 0, normalIncl: 6480, wholesaleExcl: 0, wholesaleIncl: 3500, taxRate: 8, unit: "本", minStock: 4, priceModeNormal: "INCL", priceModeWholesale: "INCL" },
  { brand: "プロラボ", name: "プロラボ ハーブザイム サプリ", category: "サプリ", normalExcl: 0, normalIncl: 4320, wholesaleExcl: 0, wholesaleIncl: 2300, taxRate: 8, unit: "袋", minStock: 6, priceModeNormal: "INCL", priceModeWholesale: "INCL" },
  // ミラクルバスト
  { brand: "ミラクルバスト", name: "ミラクルバスト クリーム", category: "化粧品", normalExcl: 7000, normalIncl: 7700, wholesaleExcl: 3500, wholesaleIncl: 3850, taxRate: 10, unit: "個", minStock: 3 },
  { brand: "ミラクルバスト", name: "ミラクルバスト サプリ", category: "サプリ", normalExcl: 0, normalIncl: 8640, wholesaleExcl: 0, wholesaleIncl: 4600, taxRate: 8, unit: "袋", minStock: 3, priceModeNormal: "INCL", priceModeWholesale: "INCL" },
  // マイデンシ
  { brand: "マイデンシ", name: "マイデンシ 電子パッチ", category: "美容機器", normalExcl: 4000, normalIncl: 4400, wholesaleExcl: 2000, wholesaleIncl: 2200, taxRate: 10, unit: "箱", minStock: 5 },
  // コーケン（備品。卸価格0のサンプル）
  { brand: "コーケン", name: "コーケン テーピング 50mm", category: "備品", normalExcl: 800, normalIncl: 880, wholesaleExcl: 0, wholesaleIncl: 0, taxRate: 10, unit: "個", minStock: 20 },
  { brand: "コーケン", name: "コーケン キネシオテープ", category: "備品", normalExcl: 1200, normalIncl: 1320, wholesaleExcl: 0, wholesaleIncl: 0, taxRate: 10, unit: "個", minStock: 15 },
  // KGジャパン
  { brand: "KGジャパン", name: "KG 高機能インソール", category: "備品", normalExcl: 5000, normalIncl: 5500, wholesaleExcl: 2500, wholesaleIncl: 2750, taxRate: 10, unit: "足", minStock: 4 },
  { brand: "KGジャパン", name: "KG サポーター 膝", category: "備品", normalExcl: 3500, normalIncl: 3850, wholesaleExcl: 1750, wholesaleIncl: 1925, taxRate: 10, unit: "個", minStock: 6 },
];
