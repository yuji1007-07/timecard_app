"use server";

import { revalidatePath } from "next/cache";
import { requireAreaManager } from "@/lib/session";
import { setSetting } from "@/lib/settings";

const KEYS = [
  "stocktakeDeadlineDay",
  "unsubmittedNotifyTime",
  "diffThresholdCount",
  "diffThresholdAmount",
  "taxRounding",
  "diffBasis",
];
const BOOL_KEYS = ["lowStockAlertEnabled", "lineEnabled", "sheetsEnabled"];

export async function saveSettings(formData: FormData): Promise<void> {
  await requireAreaManager();
  for (const k of KEYS) {
    const v = formData.get(k);
    if (v != null) await setSetting(k, String(v));
  }
  for (const k of BOOL_KEYS) {
    await setSetting(k, formData.get(k) === "on" ? "true" : "false");
  }
  revalidatePath("/settings");
}
