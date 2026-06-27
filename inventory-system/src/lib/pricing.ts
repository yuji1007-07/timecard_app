// 税抜⇄税込の自動計算ロジック。商品ごとの税率(8/10)と価格入力モードに従う。

export type Rounding = "ROUND" | "FLOOR" | "CEIL";

export function roundBy(n: number, mode: Rounding): number {
  if (mode === "FLOOR") return Math.floor(n);
  if (mode === "CEIL") return Math.ceil(n);
  return Math.round(n);
}

/** 税抜 → 税込（税込は四捨五入相当で整数化） */
export function inclFromExcl(excl: number, taxRate: number, rounding: Rounding = "ROUND"): number {
  return roundBy(excl * (1 + taxRate / 100), rounding);
}

/** 税込 → 税抜（丸めルール適用） */
export function exclFromIncl(incl: number, taxRate: number, rounding: Rounding = "ROUND"): number {
  return roundBy(incl / (1 + taxRate / 100), rounding);
}

/**
 * 入力モードに応じて税抜・税込の両方を確定する。
 * mode=EXCL: excl入力 → incl計算 / mode=INCL: incl入力 → excl計算 / mode=BOTH: 両方そのまま
 */
export function resolvePrices(
  mode: "EXCL" | "INCL" | "BOTH",
  excl: number,
  incl: number,
  taxRate: number,
  rounding: Rounding = "ROUND"
): { excl: number; incl: number } {
  if (mode === "EXCL") {
    return { excl, incl: excl > 0 ? inclFromExcl(excl, taxRate, rounding) : 0 };
  }
  if (mode === "INCL") {
    return { excl: incl > 0 ? exclFromIncl(incl, taxRate, rounding) : 0, incl };
  }
  // BOTH: 片方しか無ければもう片方を補完
  let e = excl;
  let i = incl;
  if (e > 0 && i <= 0) i = inclFromExcl(e, taxRate, rounding);
  if (i > 0 && e <= 0) e = exclFromIncl(i, taxRate, rounding);
  return { excl: e, incl: i };
}
