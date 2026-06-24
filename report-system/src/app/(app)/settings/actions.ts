"use server";

import { revalidatePath } from "next/cache";
import { requireAreaManager } from "@/lib/session";
import { setSetting } from "@/lib/settings";

const STRING_KEYS = ["weeklyDeadlineDay", "weeklyDeadlineTime", "monthlyDeadlineDay", "unsubmittedNotifyTime", "openaiModel"];
const BOOL_KEYS = ["lineEnabled", "sheetsEnabled", "aiEnabled", "alertNotifyEnabled"];

export async function saveSettings(_prev: unknown, formData: FormData) {
  await requireAreaManager();
  for (const k of STRING_KEYS) {
    const v = formData.get(k);
    if (v !== null) await setSetting(k, String(v));
  }
  for (const k of BOOL_KEYS) {
    const v = formData.get(k);
    await setSetting(k, v === "on" || v === "true" ? "true" : "false");
  }
  revalidatePath("/settings");
  return { success: true };
}
