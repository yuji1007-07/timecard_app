/**
 * 核心ロジックの自動テスト（依存フレームワークなし・tsx で実行）。
 *   npm test
 *
 * 守る不変条件:
 *  1. 税抜⇄税込の自動計算（8%/10%・各入力モード・丸めルール）
 *  2. 在庫＝最新棚卸の実数(ベースライン)＋その後の取引の符号付き合計
 *     ＝棚卸が無ければ全取引の符号付き合計
 *  3. 店舗間移動・取消の在庫への影響
 *
 * DBには触れず、純粋関数とインメモリの取引列で検証する（CIや環境非依存）。
 */
import { resolvePrices, inclFromExcl, exclFromIncl } from "../src/lib/pricing";
import { TX_SIGN } from "../src/lib/constants";

let passed = 0;
let failed = 0;

function eq(actual: unknown, expected: unknown, msg: string) {
  if (JSON.stringify(actual) === JSON.stringify(expected)) {
    passed++;
  } else {
    failed++;
    console.error(`  ✗ ${msg}\n      期待: ${JSON.stringify(expected)}  実際: ${JSON.stringify(actual)}`);
  }
}

// ===== 1) 税計算 =====
console.log("税計算:");
eq(inclFromExcl(1000, 10), 1100, "税抜1000×10% = 税込1100");
eq(inclFromExcl(1000, 8), 1080, "税抜1000×8% = 税込1080");
eq(exclFromIncl(1100, 10), 1000, "税込1100÷10% = 税抜1000");
eq(exclFromIncl(1080, 8), 1000, "税込1080÷8% = 税抜1000");
// 丸めルール（税込1000・10% → 税抜909.09...）
eq(exclFromIncl(1000, 10, "ROUND"), 909, "四捨五入");
eq(exclFromIncl(1000, 10, "FLOOR"), 909, "切り捨て");
eq(exclFromIncl(1000, 10, "CEIL"), 910, "切り上げ");
// 入力モード: EXCL→税込補完 / INCL→税抜補完 / BOTH→片方欠落を補完
eq(resolvePrices("EXCL", 2000, 0, 10), { excl: 2000, incl: 2200 }, "EXCLモード");
eq(resolvePrices("INCL", 0, 3300, 10), { excl: 3000, incl: 3300 }, "INCLモード");
eq(resolvePrices("BOTH", 5000, 0, 10), { excl: 5000, incl: 5500 }, "BOTHモード・税込欠落補完");
eq(resolvePrices("BOTH", 0, 0, 10), { excl: 0, incl: 0 }, "卸価格0はそのまま0");

// ===== 2) 在庫計算（computeStock のロジックを純粋関数で再現） =====
type Tx = { type: string; quantity: number; createdAt: number };
function computeStock(txs: Tx[], baseline?: { actual: number; cutoff: number }): number {
  const base = baseline?.actual ?? 0;
  const cutoff = baseline?.cutoff;
  let sum = 0;
  for (const t of txs) {
    if (cutoff != null && t.createdAt <= cutoff) continue;
    sum += (TX_SIGN[t.type] ?? 0) * t.quantity;
  }
  return base + sum;
}

console.log("在庫計算:");
const txs: Tx[] = [
  { type: "ORDER", quantity: 12, createdAt: 1 },
  { type: "CONSUME", quantity: 3, createdAt: 2 },
  { type: "EMPLOYEE_SALE", quantity: 1, createdAt: 3 },
  { type: "GIFT", quantity: 1, createdAt: 4 },
  { type: "TRANSFER_OUT", quantity: 3, createdAt: 5 },
];
// 棚卸なし: 12 -3 -1 -1 -3 = 4
eq(computeStock(txs), 4, "棚卸なし＝全取引の積み上げ");
// 棚卸ベースライン(cutoff=5, actual=10): cutoff以前は無視 → 10（その後の取引なし）
eq(computeStock(txs, { actual: 10, cutoff: 5 }), 10, "棚卸後・追加取引なし＝実数");
// 棚卸後に発注+5
const txs2 = [...txs, { type: "ORDER", quantity: 5, createdAt: 6 }];
eq(computeStock(txs2, { actual: 10, cutoff: 5 }), 15, "棚卸後の発注は実数に積み上がる");
// 移動先(IN)は+、取消はレコード削除で自動的に元へ戻る
eq(computeStock([{ type: "TRANSFER_IN", quantity: 3, createdAt: 1 }]), 3, "移動入庫は+");
eq(computeStock(txs.filter((t) => t.type !== "TRANSFER_OUT")), 7, "移動出庫を取消すと在庫が戻る(4→7)");

// ===== 3) ズレ計算 =====
console.log("棚卸ズレ:");
function diff(actual: number, theoretical: number, unitIncl: number) {
  const d = actual - theoretical;
  return { diff: d, amount: d * unitIncl };
}
eq(diff(7, 9, 6600), { diff: -2, amount: -13200 }, "実7-理論9 = -2 / -¥13,200");
eq(diff(12, 12, 1800), { diff: 0, amount: 0 }, "一致＝ズレ0");

console.log(`\n結果: ${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
