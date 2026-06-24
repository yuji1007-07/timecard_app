import { Badge } from "@/components/ui/badge";
import { TREND } from "@/lib/constants";

export function TrendBadge({ trend }: { trend: string }) {
  if (trend === TREND.IMPROVED) return <Badge variant="good">良化</Badge>;
  if (trend === TREND.WORSENED) return <Badge variant="bad">悪化</Badge>;
  return <Badge variant="muted">横ばい</Badge>;
}
