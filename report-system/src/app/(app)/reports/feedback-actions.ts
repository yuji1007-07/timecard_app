"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAreaManager } from "@/lib/session";
import { getReportAnalysis, buildAnalysisText } from "@/lib/report-analysis";
import { generateFeedback } from "@/lib/integrations/openai";
import { pushLineMessage, LINE_TEMPLATES } from "@/lib/integrations/line";
import { appendRows, SHEET_NAMES } from "@/lib/integrations/sheets";
import { BUSINESS_TYPES, label } from "@/lib/constants";

export async function generateFeedbackAction(reportId: string): Promise<{ content: string; usedAI: boolean }> {
  await requireAreaManager();
  const analysis = await getReportAnalysis(reportId);
  if (!analysis) throw new Error("報告が見つかりません。");
  const { report } = analysis;
  const text = buildAnalysisText(analysis);

  const result = await generateFeedback({
    storeName: report.store.name,
    departmentName: report.department?.name ?? null,
    businessType: label(BUSINESS_TYPES, report.department?.businessType ?? report.store.businessType),
    reportType: report.reportType === "WEEKLY" ? "週次" : "月次",
    kpiDiffSummary: text.diffSummary,
    prevKdiSummary: text.prevKdiSummary,
    currentKdiSummary: text.currentKdiSummary,
    kdiConsistency: text.kdiConsistency,
    alertSummary: "",
    review: text.review,
  });

  await prisma.feedback.upsert({
    where: { reportId },
    create: { reportId, aiContent: result.content },
    update: { aiContent: result.content },
  });
  revalidatePath(`/reports/${reportId}`);
  return result;
}

export async function saveFeedbackAction(reportId: string, editedContent: string) {
  await requireAreaManager();
  await prisma.feedback.upsert({
    where: { reportId },
    create: { reportId, editedContent },
    update: { editedContent },
  });
  revalidatePath(`/reports/${reportId}`);
}

export async function sendFeedbackAction(reportId: string): Promise<{ message: string }> {
  await requireAreaManager();
  const report = await prisma.report.findUnique({
    where: { id: reportId },
    include: { store: true, department: true, reporter: true, feedback: true },
  });
  if (!report) throw new Error("報告が見つかりません。");

  const content = report.feedback?.editedContent || report.feedback?.aiContent || "";

  // 送信先（院長 or 部門責任者）
  const recipients = await prisma.user.findMany({
    where: report.departmentId
      ? { departmentId: report.departmentId }
      : { storeId: report.storeId, role: "STORE_MANAGER" },
  });

  // LINE通知（設定ON & トークンありのときのみ実送信）
  let lineResults = "";
  for (const r of recipients) {
    if (r.lineUserId) {
      const res = await pushLineMessage(r.lineUserId, LINE_TEMPLATES.feedback());
      lineResults += `${r.name}: ${res.message} `;
    }
  }

  // スプレッドシート フィードバック履歴
  await appendRows(SHEET_NAMES.FEEDBACK, [
    [
      new Date().toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" }),
      report.store.name,
      report.department?.name ?? "",
      label(BUSINESS_TYPES, report.department?.businessType ?? report.store.businessType),
      report.reporter.name,
      report.feedback?.aiContent ?? "",
      content,
      new Date().toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" }),
    ],
  ]);

  await prisma.feedback.update({
    where: { reportId },
    data: { sendStatus: "SENT", sentAt: new Date(), sentTo: recipients.map((r) => r.name).join(", ") },
  });
  revalidatePath(`/reports/${reportId}`);
  return { message: `フィードバックを送信済みにしました。${lineResults || "（LINE未設定のため画面通知のみ）"}` };
}
