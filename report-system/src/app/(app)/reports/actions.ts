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

/**
 * 報告を新規作成する。
 * opts.draft=true の場合は「下書き」として保存し、フィードバック枠の作成・
 * スプレッドシート連携は行わない（提出時に実行される）。
 */
export async function submitReport(payload: ReportPayload, opts?: { draft?: boolean }) {
  const user = await requireUser();
  const isDraft = opts?.draft === true;

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
      status: isDraft ? "DRAFT" : "SUBMITTED",
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

  // 下書きの場合はここで終了（フィードバック枠・シート連携は提出時に実行）
  if (isDraft) {
    revalidatePath("/reports");
    redirect("/reports?draft=saved");
  }

  // 空のフィードバック枠を作成
  await prisma.feedback.create({ data: { reportId: report.id } });

  // Googleスプレッドシート連携（設定ONかつ認証情報があれば出力／無ければドライランで無視）
  await syncReportToSheets(payload, user.name ?? "");

  revalidatePath("/dashboard");
  revalidatePath("/reports");
  redirect(`/reports/${report.id}`);
}

/** 提出時のスプレッドシート出力（失敗しても提出はブロックしない） */
async function syncReportToSheets(payload: ReportPayload, userName: string) {
  try {
    const store = await prisma.store.findUnique({ where: { id: payload.storeId } });
    const dept = payload.departmentId ? await prisma.department.findUnique({ where: { id: payload.departmentId } }) : null;
    const sheetName = payload.reportType === "WEEKLY" ? SHEET_NAMES.WEEKLY : SHEET_NAMES.MONTHLY;
    const rows = payload.kpis.map((k) => [
      new Date().toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" }),
      payload.targetWeek ?? payload.targetMonth ?? "",
      store?.name ?? "",
      dept?.name ?? "",
      store?.businessType ?? "",
      userName,
      k.kpiName,
      k.target ?? "",
      k.current ?? "",
      k.forecast ?? "",
    ]);
    await appendRows(sheetName, rows);
  } catch {
    // 連携失敗は提出をブロックしない
  }
}

/**
 * 既存の報告（提出済み or 下書き）を更新する。
 * このレポートに紐づく子レコード（KPI値・流入・KDI・Action・前回Action進捗）を入れ替えて、
 * 本文・月次項目を更新する。差分はこのレポートより前の報告に対して再計算する。
 * 下書きの場合: opts.submit=true なら提出（SUBMITTEDに昇格・提出日時更新・シート連携）、
 * それ以外は下書きのまま保存する。
 * 注意: このレポートのActionを参照する「より新しい報告の進捗」がある場合、その進捗は再計算対象外。
 */
export async function updateReport(reportId: string, payload: ReportPayload, opts?: { submit?: boolean }) {
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

  // 下書きの扱い
  if (existing.status === "DRAFT") {
    if (opts?.submit) {
      // 下書き → 提出（提出日時を今にして昇格）
      await prisma.report.update({
        where: { id: reportId },
        data: { status: "SUBMITTED", submittedAt: new Date() },
      });
      // フィードバック枠（無ければ作成）
      const fb = await prisma.feedback.findUnique({ where: { reportId } });
      if (!fb) await prisma.feedback.create({ data: { reportId } });
      // シート連携は提出時に実行
      await syncReportToSheets(payload, user.name ?? "");
    } else {
      // 下書きのまま保存
      revalidatePath("/reports");
      redirect("/reports?draft=saved");
    }
  }

  revalidatePath("/dashboard");
  revalidatePath("/reports");
  revalidatePath(`/reports/${reportId}`);
  redirect(`/reports/${reportId}`);
}

/**
 * 報告の「対象期間」（対象月 or 対象週）だけを修正する。
 * 例: 6月の月次なのに誤って7月(2026-07)で提出した場合に 2026-06 へ直せる。
 */
export async function updateReportPeriod(formData: FormData) {
  const user = await requireUser();
  const reportId = String(formData.get("reportId") || "");
  // 月次は value(YYYY-MM)、週次は wmonth(YYYY-MM) + wweek(1〜5) から組み立てる
  const wmonth = String(formData.get("wmonth") || "").trim();
  const wweek = String(formData.get("wweek") || "").trim();
  const value = wmonth && wweek ? `${wmonth}-W${wweek}` : String(formData.get("value") || "").trim();

  const existing = await prisma.report.findUnique({ where: { id: reportId } });
  if (!existing) throw new Error("報告が見つかりません。");

  // 権限チェック（編集と同じ）
  if (user.role !== "AREA_MANAGER") {
    if (user.storeId !== existing.storeId) throw new Error("この報告は編集できません。");
    if (user.role === "DEPARTMENT_MANAGER" && user.departmentId !== existing.departmentId) {
      throw new Error("この報告は編集できません。");
    }
  }

  const isMonthly = existing.reportType === "MONTHLY";
  const valid = isMonthly ? /^\d{4}-\d{2}$/.test(value) : /^\d{4}-\d{2}-W[1-5]$/.test(value);
  if (!valid) redirect(`/reports/${reportId}/edit`);

  await prisma.report.update({
    where: { id: reportId },
    data: isMonthly ? { targetMonth: value, targetWeek: null } : { targetWeek: value, targetMonth: null },
  });

  revalidatePath("/reports");
  revalidatePath(`/reports/${reportId}`);
  redirect(`/reports/${reportId}/edit`);
}

/**
 * 報告を削除する（テストで作った報告の後始末用）。
 * 権限は編集と同じスコープ（管理者は全店、それ以外は自店舗/自部門のみ）。
 * KPI値・KDI・Action・進捗・予測などの子レコードはカスケードで一緒に消える。
 */
export async function deleteReport(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("id"));

  const report = await prisma.report.findUnique({
    where: { id },
    select: { storeId: true, departmentId: true },
  });
  if (!report) throw new Error("報告が見つかりません。");

  if (user.role !== "AREA_MANAGER") {
    if (user.storeId !== report.storeId) throw new Error("この報告は削除できません。");
    if (user.role === "DEPARTMENT_MANAGER" && user.departmentId !== report.departmentId) {
      throw new Error("この報告は削除できません。");
    }
  }

  await prisma.report.delete({ where: { id } });
  revalidatePath("/reports");
  revalidatePath("/dashboard");
}
