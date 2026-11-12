import { Badge } from "@/components/ui/badge";
import type { ProgressStatus } from "@/lib/videos";

/** 一覧のバッジ：未視聴／視聴中（◯%）／視聴完了／テスト合格 */
export function StatusBadge({ status, percent, className }: { status: ProgressStatus; percent?: number; className?: string }) {
  if (status === "PASSED") return <Badge variant="good" className={className}>テスト合格</Badge>;
  if (status === "COMPLETED") return <Badge className={`border-transparent bg-blue-100 text-blue-800 ${className ?? ""}`}>視聴完了</Badge>;
  if (status === "IN_PROGRESS") return <Badge variant="warn" className={className}>視聴中（{percent ?? 0}%）</Badge>;
  return <Badge variant="muted" className={className}>未視聴</Badge>;
}
