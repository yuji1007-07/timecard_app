import { CONSISTENCY, TREND, type AlertOperator } from "@/lib/constants";

export type KpiValueLike = {
  kpiName: string;
  unit?: string | null;
  target?: number | null;
  current?: number | null;
  forecast?: number | null;
  goodDirection?: string; // UP | DOWN
};

export type KpiDiffRow = {
  kpiName: string;
  unit?: string | null;
  prev: number | null;
  curr: number | null;
  diff: number | null;
  rate: number | null; // 増減率(%)
  trend: string; // 良化 | 悪化 | 横ばい
  goodDirection: string;
};

/**
 * 前回・今回のKPI値から差分を判定する。
 * goodDirection(UP/DOWN)に基づいて良化/悪化を決める。
 */
export function computeKpiDiff(
  prevValues: KpiValueLike[],
  currValues: KpiValueLike[]
): KpiDiffRow[] {
  const prevMap = new Map(prevValues.map((v) => [v.kpiName, v]));

  return currValues.map((curr) => {
    const prev = prevMap.get(curr.kpiName);
    const p = prev?.current ?? null;
    const c = curr.current ?? null;
    const goodDirection = curr.goodDirection ?? "UP";

    let diff: number | null = null;
    let rate: number | null = null;
    let trend: string = TREND.FLAT;

    if (p !== null && c !== null) {
      diff = Math.round((c - p) * 100) / 100;
      rate = p !== 0 ? Math.round(((c - p) / Math.abs(p)) * 1000) / 10 : null;
      if (diff === 0) {
        trend = TREND.FLAT;
      } else if (goodDirection === "UP") {
        trend = diff > 0 ? TREND.IMPROVED : TREND.WORSENED;
      } else {
        trend = diff < 0 ? TREND.IMPROVED : TREND.WORSENED;
      }
    }

    return {
      kpiName: curr.kpiName,
      unit: curr.unit,
      prev: p,
      curr: c,
      diff,
      rate,
      trend,
      goodDirection,
    };
  });
}

/** 目標達成率(%)。target が無い/0 の場合は null。 */
export function achievementRate(current: number | null, target: number | null, goodDirection = "UP"): number | null {
  if (current === null || target === null || target === 0) return null;
  // 減ると良いKPIは「目標以下なら100%超」とする
  const r = goodDirection === "DOWN" ? (target / current) * 100 : (current / target) * 100;
  return Math.round(r * 10) / 10;
}

// ===== 要注意条件の評価 =====
export type AlertEvalInput = {
  operator: AlertOperator;
  threshold?: number | null;
  current?: number | null;
  target?: number | null;
  prev?: number | null;
  submitted?: boolean;
  actionDone?: boolean;
};

/** 単一の要注意条件にKPI値が該当するか判定する。 */
export function evaluateAlert(input: AlertEvalInput): boolean {
  const { operator, threshold, current, target, prev, submitted, actionDone } = input;
  switch (operator) {
    case "GTE":
      return current != null && threshold != null && current >= threshold;
    case "LTE":
      return current != null && threshold != null && current <= threshold;
    case "LT":
      return current != null && threshold != null && current < threshold;
    case "GT":
      return current != null && threshold != null && current > threshold;
    case "INCREASED":
      return current != null && prev != null && current > prev;
    case "DECREASED":
      return current != null && prev != null && current < prev;
    case "BELOW_TARGET":
      return current != null && target != null && current < target;
    case "NOT_SUBMITTED":
      return submitted === false;
    case "ACTION_NOT_DONE":
      return actionDone === false;
    default:
      return false;
  }
}

// ===== KDI と結果の接続チェック =====
export type ConsistencyInput = {
  actionContent: string;
  relatedKpiName?: string | null;
  status?: string | null; // 進捗ステータス
  prevKpi: number | null;
  currKpi: number | null;
  goodDirection: string; // UP | DOWN
};

export type ConsistencyResult = {
  judgement: string; // CONSISTENCY のいずれか
  comment: string;
};

/**
 * 前回KDI/Actionが今回のKPI変化につながっているか判定。
 * - 関連KPIが無い / 数値が揃わない → 判断不能
 * - 実施(完了/一部/継続)かつ良化 → 整合性あり
 * - 実施したが良化していない → 整合性やや弱い
 * - 未実施/中止 → 整合性なし
 */
export function checkConsistency(input: ConsistencyInput): ConsistencyResult {
  const { relatedKpiName, status, prevKpi, currKpi, goodDirection } = input;

  if (!relatedKpiName || prevKpi === null || currKpi === null) {
    return {
      judgement: CONSISTENCY.UNKNOWN,
      comment: "関連KPIまたは数値が不足しているため、整合性を判断できません。",
    };
  }

  const improved =
    goodDirection === "UP" ? currKpi > prevKpi : currKpi < prevKpi;
  const executed = status === "COMPLETED" || status === "PARTIAL" || status === "ONGOING";
  const arrow = `${prevKpi} → ${currKpi}`;

  if (!executed) {
    return {
      judgement: CONSISTENCY.NONE,
      comment: `Actionが実施されていません（${arrow}）。まず実行に移すことが必要です。`,
    };
  }
  if (improved) {
    return {
      judgement: CONSISTENCY.OK,
      comment: `前回Actionが関連KPI（${relatedKpiName}: ${arrow}）の改善につながっている可能性があります。継続推奨です。`,
    };
  }
  return {
    judgement: CONSISTENCY.WEAK,
    comment: `Actionは実施されていますが、${relatedKpiName}（${arrow}）の改善にはつながっていません。実施内容・対象者・頻度の見直しが必要です。`,
  };
}

// ===== KDI整合性チェック（今回のKDIが未達KPIに対して適切か） =====
export type KdiCheckInput = {
  unmetKpiNames: string[]; // 未達KPI名
  kdis: {
    name: string;
    relatedKpiName?: string | null;
    assignee?: string | null;
    deadline?: string | null;
    frequency?: string | null;
  }[];
  unfinishedPrevActions: number; // 前回未完了Action数
};

export type KdiCheckResult = {
  level: "OK" | "WARN" | "FIX"; // 問題なし | 注意 | 要修正
  messages: string[];
};

export function checkKdiConsistency(input: KdiCheckInput): KdiCheckResult {
  const { unmetKpiNames, kdis, unfinishedPrevActions } = input;
  const messages: string[] = [];
  let level: KdiCheckResult["level"] = "OK";

  const coveredKpis = new Set(kdis.map((k) => k.relatedKpiName).filter(Boolean) as string[]);
  const uncovered = unmetKpiNames.filter((k) => !coveredKpis.has(k));
  if (uncovered.length > 0) {
    messages.push(`未達KPI「${uncovered.join("、")}」に対して関連KDIが設定されていません。`);
    level = "FIX";
  }

  for (const k of kdis) {
    if (!k.assignee) {
      messages.push(`KDI「${k.name}」に担当者が設定されていません。`);
      if (level !== "FIX") level = "WARN";
    }
    if (!k.deadline) {
      messages.push(`KDI「${k.name}」に期限が設定されていません。`);
      if (level !== "FIX") level = "WARN";
    }
  }

  if (unfinishedPrevActions > 0) {
    messages.push(`前回未完了のActionが${unfinishedPrevActions}件あります。放置されていないか確認してください。`);
    if (level !== "FIX") level = "WARN";
  }

  if (messages.length === 0) messages.push("未達KPIに対して関連KDIが設定され、担当者・期限も揃っています。");
  return { level, messages };
}
