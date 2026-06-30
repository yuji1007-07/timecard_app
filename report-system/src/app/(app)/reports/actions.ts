"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { appendRows, SHEET_NAMES } from "@/lib/integrations/sheets";

export type ReportPayload = {
  storeId: string;
  departmentId: string | null;
  reportType: "WEEKLY" | "MONTHLY";
  targetWeek: string | null;
  targetMonth: string | null;
  originalText?: string;
  review: {
    goodPoints?: string;
    badPoints?: string;
    dataIssues?: string;
    doneThings?: string;
    notDoneThings?: string;
  };
  monthly?: {
    monthlySummary?: string;
    successCases?: string;
    missFactors?: string;
    nextMonthFocusKpi?: string;
    nextMonthKdi?: string;
    nextMonthAction?: string;
    hrIssues?: string;
    marketingIssues?: string;
    educationIssues?: string;
    operationIssues?: string;
  } | null;
  kpis: { kpiItemId: string; kpiName: string; unit: string; target: number | null; current: number | null; forecast: number | null; comment: string }[];
  inflows: { channel: string; count: number }[];
  kdis: {
    kdiItemId: string | null;
    name: string;
    relatedKpiName: string | null;
    assignee: string;
    deadline: string;
    frequency: string;
    count: number | null;
    targetPerson: string;
    status: string;
    comment: string;
  }[];
  actions: {
    content: string;
    relatedKpiName: string | null;
    baseValue: number | null;
    targetValue: number | null;
    assignee: string;
    deadline: string;
    frequency: string;
    expectedEffect: string;
    successCondition: string;
  }[];
  progresses: { previousActionId: string; status: string; comment: string }[];
  // 月次: 来月以降の予測（ローリング予測）
  projections?: { kpiName: string; targetMonth: string; budget: number | null; forecast: number | null }[];
};

export async function submitReport(payload: ReportPayload) {
  const user = await requireUser();

  // 権限チェック: 管理者以外は自店舗/自部門のみ
  if (user.role !== "AREA_MANAGER") {
    if (user.storeId !== payload.storeId) throw new Error("この店舗の報告は提出できません。");
    if (user.role === "DEPARTMENT_MANAGER" && user.departmentId !== payload.departmentId) {
      throw new Error("この部門の報告は提出できません。");
    }
  }

  // 前回報告（差分計算用）
  const prevReport = await prisma.report.findFirst({
    where: { storeId: payload.storeId, departmentId: payload.departmentId, reportType: payload.reportType, status: "SUBMITTED" },
    orderBy: { submittedAt: "desc" },
    include: { kpiValues: true, actions: true },
  });
  const prevKpiByName = new Map((prevReport?.kpiValues ?? []).map((v) => [v.kpiName, v.current]));
  const currKpiByName = new Map(payload.kpis.map((k) => [k.kpiName, k.current]));
  const prevActionById = new Map((prevReport?.actions ?? []).map((a) => [a.id, a]));

  const report = await prisma.report.create({
    data: {
      storeId: payload.storeId,
      departmentId: payload.departmentId,
      reporterId: user.id,
      reportType: payload.reportType,
      targetWeek: payload.targetWeek,
      targetMonth: payload.targetMonth,
      status: "SUBMITTED",
      originalText: payload.originalText || null,
      goodPoints: payload.review.goodPoints || null,
      badPoints: payload.review.badPoints || null,
      dataIssues: payload.review.dataIssues || null,
      doneThings: payload.review.doneThings || null,
      notDoneThings: payload.review.notDoneThings || null,
      monthlySummary: payload.monthly?.monthlySummary || null,
      successCases: payload.monthly?.successCases || null,
      missFactors: payload.monthly?.missFactors || null,
      nextMonthFocusKpi: payload.monthly?.nextMonthFocusKpi || null,
      nextMonthKdi: payload.monthly?.nextMonthKdi || null,
      nextMonthAction: payload.monthly?.nextMonthAction || null,
      hrIssues: payload.monthly?.hrIssues || null,
      marketingIssues: payload.monthly?.marketingIssues || null,
      educationIssues: payload.monthly?.educationIssues || null,
      operationIssues: payload.monthly?.operationIssues || null,
      kpiValues: {
        create: payload.kpis.map((k) => ({
          kpiItemId: k.kpiItemId,
          kpiName: k.kpiName,
          unit: k.unit,
          target: k.target,
          current: k.current,
          forecast: k.forecast,
          comment: k.comment || null,
        })),
      },
      inflows: { create: payload.inflows.filter((i) => i.count > 0).map((i) => ({ channel: i.channel, count: i.count })) },
      kdis: {
        create: payload.kdis
          .filter((k) => k.name.trim())
          .map((k) => ({
            kdiItemId: k.kdiItemId,
            name: k.name,
            relatedKpiName: k.relatedKpiName || null,
            assignee: k.assignee || null,
            deadline: k.deadline || null,
            frequency: k.frequency || null,
            count: k.count,
            targetPerson: k.targetPerson || null,
            status: k.status || "ONGOING",
            comment: k.comment || null,
          })),
      },
      actions: {
        create: payload.actions
          .filter((a) => a.content.trim() || (a.relatedKpiName && a.relatedKpiName.trim()))
          .map((a) => ({
            content: a.content || (a.relatedKpiName ?? "Action"),
            relatedKpiName: a.relatedKpiName || null,
            baseValue: a.baseValue,
            targetValue: a.targetValue,
            assignee: a.assignee || null,
            deadline: a.deadline || null,
            frequency: a.frequency || null,
            expectedEffect: a.expectedEffect || null,
            successCondition: a.successCondition || null,
          })),
      },
      projections: {
        create: (payload.projections ?? [])
          .filter((p) => p.budget != null || p.forecast != null)
          .map((p) => ({ kpiName: p.kpiName, targetMonth: p.targetMonth, budget: p.budget, forecast: p.forecast })),
      },
    },
  });

  // 前回Action進捗（差分を自動計算）
  for (const p of payload.progresses) {
    const prevAction = prevActionById.get(p.previousActionId);
    const kpiName = prevAction?.relatedKpiName ?? null;
    const prevVal = kpiName ? prevKpiByName.get(kpiName) ?? null : null;
    const currVal = kpiName ? currKpiByName.get(kpiName) ?? null : null;
    const diff = prevVal != null && currVal != null ? Math.round((currVal - prevVal) * 100) / 100 : null;
    await prisma.actionProgress.create({
      data: {
        reportId: report.id,
        previousActionId: p.previousActionId,
        status: p.status || "ONGOING",
        comment: p.comment || null,
        prevKpiValue: prevVal,
        currentKpiValue: currVal,
        diff,
      },
    });
  }

  // 空のフィードバック枠を作成
  await prisma.feedback.create({ data: { reportId: report.id } });

  // Googleスプレッドシート連携（設定ONかつ認証情報があれば出力／無ければドライランで無視）
  try {
    const store = await prisma.store.findUnique({ where: { id: payload.storeId } });
    const dept = payload.departmentId ? await prisma.department.findUnique({ where: { id: payload.departmentId } }) : null;
    const sheetName = payload.reportType === "WEEKLY" ? SHEET_NAMES.WEEKLY : SHEET_NAMES.MONTHLY;
    const rows = payload.kpis.map((k) => [
      new Date().toLocaleString("ja-JP"),
      payload.targetWeek ?? payload.targetMonth ?? "",
      store?.name ?? "",
      dept?.name ?? "",
      store?.businessType ?? "",
      user.name ?? "",
      k.kpiName,
      k.target ?? "",
      k.current ?? "",
      k.forecast ?? "",
    ]);
    await appendRows(sheetName, rows);
  } catch {
    // 連携失敗は提出をブロックしない
  }

  revalidatePath("/dashboard");
  revalidatePath("/reports");
  redirect(`/reports/${report.id}`);
}

/**
 * 既に提出済みの報告を修正する。
 * このレポートに紐づく子レコード（KPI値・流入・KDI・Action・前回Action進捗）を入れ替えて、
 * 本文・月次項目を更新する。差分はこのレポートより前の報告に対して再計算する。
 * 注意: このレポートのActionを参照する「より新しい報告の進捗」がある場合、その進捗は再計算対象外。
 */
export async function updateReport(reportId: string, payload: ReportPayload) {
  const user = await requireUser();

  const existing = await prisma.report.findUnique({ where: { id: reportId } });
  if (!existing) throw new Error("報告が見つかりません。");

  // 権限チェック: 管理者以外は自店舗/自部門のみ
  if (user.role !== "AREA_MANAGER") {
    if (user.storeId !== existing.storeId) throw new Error("この報告は編集できません。");
    if (user.role === "DEPARTMENT_MANAGER" && user.departmentId !== existing.departmentId) {
      throw new Error("この報告は編集できません。");
    }
  }

  // 直前の報告（このレポートより前・同一スコープ）で差分を再計算
  const prevReport = await prisma.report.findFirst({
    where: {
      storeId: existing.storeId,
      departmentId: existing.departmentId,
      reportType: existing.reportType,
      status: "SUBMITTED",
      submittedAt: { lt: existing.submittedAt },
      id: { not: reportId },
    },
    orderBy: { submittedAt: "desc" },
    include: { kpiValues: true, actions: true },
  });
  const prevKpiByName = new Map((prevReport?.kpiValues ?? []).map((v) => [v.kpiName, v.current]));
  const currKpiByName = new Map(payload.kpis.map((k) => [k.kpiName, k.current]));
  const prevActionById = new Map((prevReport?.actions ?? []).map((a) => [a.id, a]));

  await prisma.$transaction(async (tx) => {
    // このレポートの子レコードを入れ替え
    await tx.actionProgress.deleteMany({ where: { reportId } });
    await tx.reportKpiValue.deleteMany({ where: { reportId } });
    await tx.reportInflow.deleteMany({ where: { reportId } });
    await tx.reportKdi.deleteMany({ where: { reportId } });
    await tx.reportAction.deleteMany({ where: { reportId } });
    await tx.reportProjection.deleteMany({ where: { reportId } });

    await tx.report.update({
      where: { id: reportId },
      data: {
        originalText: payload.originalText || null,
        goodPoints: payload.review.goodPoints || null,
        badPoints: payload.review.badPoints || null,
        dataIssues: payload.review.dataIssues || null,
        doneThings: payload.review.doneThings || null,
        notDoneThings: payload.review.notDoneThings || null,
        monthlySummary: payload.monthly?.monthlySummary || null,
        successCases: payload.monthly?.successCases || null,
        missFactors: payload.monthly?.missFactors || null,
        nextMonthFocusKpi: payload.monthly?.nextMonthFocusKpi || null,
        nextMonthKdi: payload.monthly?.nextMonthKdi || null,
        nextMonthAction: payload.monthly?.nextMonthAction || null,
        hrIssues: payload.monthly?.hrIssues || null,
        marketingIssues: payload.monthly?.marketingIssues || null,
        educationIssues: payload.monthly?.educationIssues || null,
        operationIssues: payload.monthly?.operationIssues || null,
        kpiValues: {
          create: payload.kpis.map((k) => ({
            kpiItemId: k.kpiItemId,
            kpiName: k.kpiName,
            unit: k.unit,
            target: k.target,
            current: k.current,
            forecast: k.forecast,
            comment: k.comment || null,
          })),
        },
        inflows: { create: payload.inflows.filter((i) => i.count > 0).map((i) => ({ channel: i.channel, count: i.count })) },
        kdis: {
          create: payload.kdis
            .filter((k) => k.name.trim())
            .map((k) => ({
              kdiItemId: k.kdiItemId,
              name: k.name,
              relatedKpiName: k.relatedKpiName || null,
              assignee: k.assignee || null,
              deadline: k.deadline || null,
              frequency: k.frequency || null,
              count: k.count,
              targetPerson: k.targetPerson || null,
              status: k.status || "ONGOING",
              comment: k.comment || null,
            })),
        },
        actions: {
          create: payload.actions
            .filter((a) => a.content.trim() || (a.relatedKpiName && a.relatedKpiName.trim()))
            .map((a) => ({
              content: a.content || (a.relatedKpiName ?? "Action"),
              relatedKpiName: a.relatedKpiName || null,
              baseValue: a.baseValue,
              targetValue: a.targetValue,
              assignee: a.assignee || null,
              deadline: a.deadline || null,
              frequency: a.frequency || null,
              expectedEffect: a.expectedEffect || null,
              successCondition: a.successCondition || null,
            })),
        },
        projections: {
          create: (payload.projections ?? [])
            .filter((p) => p.budget != null || p.forecast != null)
            .map((p) => ({ kpiName: p.kpiName, targetMonth: p.targetMonth, budget: p.budget, forecast: p.forecast })),
        },
      },
    });

    // 前回Action進捗（差分を再計算）
    for (const p of payload.progresses) {
      const prevAction = prevActionById.get(p.previousActionId);
      const kpiName = prevAction?.relatedKpiName ?? null;
      const prevVal = kpiName ? prevKpiByName.get(kpiName) ?? null : null;
      const currVal = kpiName ? currKpiByName.get(kpiName) ?? null : null;
      const diff = prevVal != null && currVal != null ? Math.round((currVal - prevVal) * 100) / 100 : null;
      await tx.actionProgress.create({
        data: {
          reportId,
          previousActionId: p.previousActionId,
          status: p.status || "ONGOING",
          comment: p.comment || null,
          prevKpiValue: prevVal,
          currentKpiValue: currVal,
          diff,
        },
      });
    }
  });

  revalidatePath("/dashboard");
  revalidatePath("/reports");
  revalidatePath(`/reports/${reportId}`);
  redirect(`/reports/${reportId}`);
}
