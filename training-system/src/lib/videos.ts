// 動画の「誰に見せるか」「誰が必修か」と、進捗の状態判定。
// スタッフ画面・本部の進捗表・CSV出力のすべてがここを通る。

import { BRAND_CATEGORY, DUE_SOON_DAYS, LEADER_POSITIONS } from "@/lib/constants";
import { daysUntil } from "@/lib/time";

export type VideoRule = {
  category: string;
  audience: string;
  requiredScope: string;
  isPublished: boolean;
};

export type Viewer = {
  role: string;
  position: string;
  brand: string | null; // 所属店舗のブランド
};

/** その人の一覧にこの動画を出すか（本部は全部見られる） */
export function isVideoVisibleTo(video: VideoRule, viewer: Viewer): boolean {
  if (viewer.role === "ADMIN") return true;
  if (!video.isPublished) return false;
  // 本部所属のスタッフは部門を問わず見られる。店舗スタッフは「全部門共通」と自分のブランドだけ
  if (video.category !== "COMMON" && viewer.brand !== "本部") {
    if (!viewer.brand || BRAND_CATEGORY[viewer.brand] !== video.category) return false;
  }
  if (video.audience === "LEADERS" && !LEADER_POSITIONS.includes(viewer.position)) return false;
  return true;
}

/** その人にとって必修か */
export function isRequiredFor(video: VideoRule, viewer: Viewer): boolean {
  if (viewer.role === "ADMIN") return false;
  if (!isVideoVisibleTo(video, viewer)) return false;
  if (video.requiredScope === "ALL") return true;
  if (video.requiredScope === "LEADERS") return LEADER_POSITIONS.includes(viewer.position);
  return false;
}

export type ProgressStatus = "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED" | "PASSED";

export const STATUS_LABELS: Record<ProgressStatus, string> = {
  NOT_STARTED: "未視聴",
  IN_PROGRESS: "視聴中",
  COMPLETED: "視聴完了",
  PASSED: "テスト合格",
};

export function statusOf(
  progress: { percent: number; completedAt: Date | string | null } | null | undefined,
  passed: boolean
): ProgressStatus {
  if (progress?.completedAt) return passed ? "PASSED" : "COMPLETED";
  if (progress && progress.percent > 0) return "IN_PROGRESS";
  return "NOT_STARTED";
}

/** 研修として「完了」か。テストがある動画は合格まで、無い動画は視聴完了まで */
export function isDone(status: ProgressStatus, hasQuiz: boolean): boolean {
  return hasQuiz ? status === "PASSED" : status === "COMPLETED" || status === "PASSED";
}

export type DueState = "OVERDUE" | "SOON" | "LATER" | "NONE";

export function dueStateOf(dueDate: string | null | undefined, today: string): DueState {
  if (!dueDate) return "NONE";
  const d = daysUntil(dueDate, today);
  if (d < 0) return "OVERDUE";
  if (d <= DUE_SOON_DAYS) return "SOON";
  return "LATER";
}
