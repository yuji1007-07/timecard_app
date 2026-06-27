import { cn } from "@/lib/utils";
import {
  BUSINESS_TYPES,
  BUSINESS_TYPE_CLASS,
  STORE_STATUS,
  STORE_STATUS_CLASS,
  TX_TYPES,
  TX_TYPE_CLASS,
  label,
} from "@/lib/constants";

export function BrandBadge({ name, color }: { name: string; color?: string | null }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium"
      style={{ borderColor: (color ?? "#1e3a5f") + "55", color: color ?? "#1e3a5f", backgroundColor: (color ?? "#1e3a5f") + "12" }}
    >
      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color ?? "#1e3a5f" }} />
      {name}
    </span>
  );
}

export function BusinessTypeBadge({ type }: { type: string }) {
  return (
    <span className={cn("inline-block rounded-full border px-2 py-0.5 text-xs font-medium", BUSINESS_TYPE_CLASS[type] ?? "")}>
      {label(BUSINESS_TYPES, type)}
    </span>
  );
}

export function StoreStatusBadge({ status }: { status: string }) {
  return (
    <span className={cn("inline-block rounded-full border px-2 py-0.5 text-xs font-medium", STORE_STATUS_CLASS[status] ?? "")}>
      {label(STORE_STATUS, status)}
    </span>
  );
}

export function TxTypeBadge({ type }: { type: string }) {
  return (
    <span className={cn("inline-block rounded-full border px-2 py-0.5 text-xs font-medium", TX_TYPE_CLASS[type] ?? "")}>
      {label(TX_TYPES, type)}
    </span>
  );
}
