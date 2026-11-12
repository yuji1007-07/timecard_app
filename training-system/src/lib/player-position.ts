// プレーヤーの現在の再生位置を、同じページの質問フォームに渡すための小さな置き場（クライアント専用）
let position = 0;

export function setPlayerPosition(sec: number) {
  position = sec;
}

export function getPlayerPosition(): number {
  return position;
}
