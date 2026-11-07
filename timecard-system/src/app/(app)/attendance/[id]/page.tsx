import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { canAccessStore, requireManager } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EditForm } from "./edit-form";
import { deleteAttendance } from "../actions";
import { toInputValue, weekdayJa } from "@/lib/time";

export const dynamic = "force-dynamic";

export default async function EditAttendancePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ month?: string; storeId?: string }>;
}) {
  const user = await requireManager();
  const { id } = await params;
  const sp = await searchParams;
  const returnTo = `month=${sp.month ?? ""}${sp.storeId ? `&storeId=${sp.storeId}` : ""}`;

  const record = await prisma.attendance.findUnique({ where: { id }, include: { user: true, store: true } });
  if (!record) notFound();
  if (!canAccessStore(user, record.storeId)) redirect("/attendance");

  return (
    <div>
      <PageHeader
        title="打刻編集"
        description={`${record.store.name} / ${record.user.name} / ${record.workDate}（${weekdayJa(record.workDate)}）`}
        action={
          <Link href={`/attendance?${returnTo}`}>
            <Button variant="outline">勤怠管理へ戻る</Button>
          </Link>
        }
      />
      <Card className="max-w-3xl">
        <CardContent className="pt-5">
          <EditForm
            record={{
              id: record.id,
              clockIn: toInputValue(record.clockIn),
              breakStart: toInputValue(record.breakStart),
              breakEnd: toInputValue(record.breakEnd),
              clockOut: toInputValue(record.clockOut),
              breakMinutes: record.breakMinutes,
              note: record.note ?? "",
            }}
            returnTo={returnTo}
          />
          {user.isAdmin && (
            <form action={deleteAttendance} className="mt-6 border-t pt-4">
              <input type="hidden" name="id" value={record.id} />
              <input type="hidden" name="returnTo" value={returnTo} />
              <Button type="submit" variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                この打刻を削除する
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
