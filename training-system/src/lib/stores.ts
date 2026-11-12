// 店舗名の正規化とブランド自動判定（旧Flask版の detect_brand_and_store と同じ挙動）

/** 全角・半角のゆれ、空白のゆれを吸収する */
export function normalizeText(value: string | null | undefined): string {
  let text = (value ?? "").normalize("NFKC");
  text = text.replace(/　/g, " ");
  return text.split(/\s+/).filter(Boolean).join(" ");
}

/** 店舗の表示名からブランドと短縮名を判定する */
export function detectBrandAndStore(displayName: string): { brand: string; shortName: string } {
  const n = normalizeText(displayName);

  if (n === "本部" || n.startsWith("本部")) return { brand: "本部", shortName: n };
  if (n.startsWith("鍼灸ラコンシェル")) return { brand: "鍼灸ラコンシェル", shortName: n.replace("鍼灸ラコンシェル", "").trim() };
  if (n.startsWith("ラコンシェル")) return { brand: "ラコンシェル", shortName: n.replace("ラコンシェル", "").trim() };
  if (n.startsWith("ラ・コンシェル")) return { brand: "ラコンシェル", shortName: n.replace("ラ・コンシェル", "").trim() };
  if (n.startsWith("からだラボ武蔵整骨院")) return { brand: "からだラボ整骨院", shortName: n.replace("からだラボ武蔵整骨院", "").trim() };
  if (n.startsWith("からだラボ整骨院")) return { brand: "からだラボ整骨院", shortName: n.replace("からだラボ整骨院", "").trim() };
  if (n.startsWith("からだラボ駅前整骨院")) return { brand: "からだラボ整骨院", shortName: "駅前整骨院" };
  if (n.startsWith("からだラボ")) return { brand: "からだラボ整骨院", shortName: n.replace("からだラボ", "").trim() };
  if (n.includes("整骨院")) return { brand: "からだラボ整骨院", shortName: n };
  return { brand: "からだラボ整骨院", shortName: n };
}

/**
 * CSV などに書かれた店舗名から店舗マスタを探す。
 * 1) 正規化した名前が完全一致 → 2) 短縮名（例: 町田店）が一致、または名前の一部として含まれる店舗が1つだけ
 * あいまいで決められないときは null。
 */
export function matchStore<T extends { name: string; shortName: string }>(stores: T[], text: string): T | null {
  const n = normalizeText(text);
  if (!n) return null;
  const compact = (s: string) => normalizeText(s).replace(/\s/g, "");
  const exact = stores.find((s) => compact(s.name) === compact(n));
  if (exact) return exact;
  const candidates = stores.filter((s) => compact(s.shortName) === compact(n) || compact(s.name).includes(compact(n)));
  return candidates.length === 1 ? candidates[0] : null;
}
