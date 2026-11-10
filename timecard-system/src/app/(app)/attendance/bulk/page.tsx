import Link from "next/link";
import { requireManager } from "@/lib/session";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FilterForm } from "../filter-form";
import { BulkEditTable } from "./bulk-edit-table";
import { queryAttendance, resolveStoreScope } from "@/lib/attendance";
import { monthLabel, thisMonthJst, toInputValue, toTimeValue } from "@/lib/time";
import { StaffTabs, filterByUser, staffOptions } from "../staff-tabs";

export const dynamic = "force-dynamic";

type SP = { month?: string; storeId?: string; userId?: string; msg?: string };

export default async function BulkEditPage({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await requireManager();
  const sp = await searchParams;
  const month = /^\d{4}-\d{2}$/.test(sp.month ?? "") ? sp.month! : thisMonthJst();
  const { stores, selectedStoreId, scopeIds, warning } = await resolveStoreScope(user, sp.storeId);
  const allRecords = await queryAttendance(month, scopeIds);
  const qs = `month=${month}${selectedStoreId ? `&storeId=${selectedStoreId}` : ""}`;
  const staff = staffOptions(allRecords);
  const userId = sp.userId && staff.some((s) => s.id === sp.userId) ? sp.userId : "";
  const records = filterByUser(allRecords, userId);

  const rows = records.map((r) => ({
    id: r.id,
    workDate: r.workDate,
    storeName: r.store.name,
    userName: r.user.name,
    clockIn: toInputValue(r.clockIn),
    breakStart: toTimeValue(r.breakStart),
    breakEnd: toTimeValue(r.breakEnd),
    clockOut: toInputValue(r.clockOut),
    breakMinutes: r.breakMinutes,
    note: r.note ?? "",
  }));

  return (
    <div>
      <PageHeader
        title="打刻一括編集"
        description={`${monthLabel(month)}。時刻を修正して「まとめて保存」を押すと、変更した行だけが更新されます。休憩開始・終了を入力すると休憩(分)は自動計算されます。`}
        action={
          <Link href={`/attendance?${qs}`}>
            <Button variant="outline">勤怠管理へ戻る</Button>
          </Link>
        }
      />

      {warning && <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{warning}</div>}

      <Card className="mb-6">
        <CardContent className="pt-5">
          <FilterForm basePath="/attendance/bulk" month={month} storeId={selectedStoreId ?? ""} stores={stores} canViewAll={user.isAdmin} />
        </CardContent>
      </Card>

      <StaffTabs basePath="/attendance/bulk" qs={qs} staff={staff} userId={userId} />
      <BulkEditTable rows={rows} />
    </div>
  );
}
