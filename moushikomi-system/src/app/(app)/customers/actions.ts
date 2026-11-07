"use server";

import { requireUser } from "@/lib/session";
import { getApplicationsFor } from "@/lib/data";
import type { ApplicationData } from "@/lib/types";

/** バックアップ(ZIP保存)用に、申込書を署名画像込みで取得する（権限外のものは返さない） */
export async function fetchApplicationsForBackup(ids: string[]): Promise<ApplicationData[]> {
  const me = await requireUser();
  const clean = ids.filter((x) => typeof x === "string").slice(0, 2000);
  return getApplicationsFor(me, clean);
}
