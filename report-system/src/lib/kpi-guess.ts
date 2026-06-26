/** KPI名から単位を推定する。 */
export function guessUnit(name: string): string {
  if (/率$/.test(name)) return "%";
  if (/単価/.test(name)) return "円";
  if (/頻度|回数/.test(name)) return "回";
  if (/日数$/.test(name)) return "日";
  if (/枚数/.test(name)) return "枚";
  if (/件$/.test(name)) return "件";
  if (/数$/.test(name)) return "人";
  return "円";
}

/** KPI名から良化方向を推定する（離反・退会・休会・解約・幽霊系は減ると良い）。 */
export function guessDirection(name: string): "UP" | "DOWN" {
  return /離反|退会|休会|解約|キャンセル|未達|未提出|幽霊/.test(name) ? "DOWN" : "UP";
}
