import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// ===== KPI 初期テンプレート定義 =====
type KpiDef = { name: string; unit: string; goodDirection?: "UP" | "DOWN"; inputType?: string; dashboard?: boolean };

const SEIKOTSU_KPI: KpiDef[] = [
  { name: "売上", unit: "円", dashboard: true },
  { name: "日割り", unit: "円" },
  { name: "自費", unit: "円" },
  { name: "楽トレ", unit: "円" },
  { name: "骨盤", unit: "円" },
  { name: "月会費", unit: "円" },
  { name: "物販", unit: "円" },
  { name: "自賠責", unit: "円" },
  { name: "プリカ", unit: "円" },
  { name: "初診数", unit: "人", dashboard: true },
  { name: "再診数", unit: "人" },
  { name: "会員数", unit: "人", dashboard: true },
  { name: "カルテ枚数", unit: "枚", dashboard: true },
  { name: "通院頻度", unit: "回" },
  { name: "離反率", unit: "%", goodDirection: "DOWN", inputType: "PERCENT", dashboard: true },
  { name: "成約率", unit: "%", inputType: "PERCENT", dashboard: true },
];

const ESTHE_KPI: KpiDef[] = [
  { name: "売上", unit: "円", dashboard: true },
  { name: "新規売上", unit: "円" },
  { name: "継続売上", unit: "円" },
  { name: "プレミアム売上", unit: "円" },
  { name: "定額売上", unit: "円" },
  { name: "物販売上", unit: "円" },
  { name: "回数券売上", unit: "円" },
  { name: "新規数", unit: "人", dashboard: true },
  { name: "契約数", unit: "件", dashboard: true },
  { name: "カルテ枚数", unit: "枚", dashboard: true },
  { name: "来店頻度", unit: "回" },
  { name: "離反率", unit: "%", goodDirection: "DOWN", inputType: "PERCENT", dashboard: true },
  { name: "成約率", unit: "%", inputType: "PERCENT", dashboard: true },
  { name: "平均窓口単価", unit: "円" },
  { name: "ホットペッパー流入", unit: "人" },
  { name: "Google流入", unit: "人" },
  { name: "紹介数", unit: "人" },
];

const SHINKYU_KPI: KpiDef[] = [
  { name: "売上", unit: "円", dashboard: true },
  { name: "美容鍼売上", unit: "円" },
  { name: "鍼灸売上", unit: "円" },
  { name: "回数券売上", unit: "円" },
  { name: "定額売上", unit: "円" },
  { name: "新規数", unit: "人", dashboard: true },
  { name: "契約数", unit: "件", dashboard: true },
  { name: "カルテ枚数", unit: "枚", dashboard: true },
  { name: "来店頻度", unit: "回" },
  { name: "離反率", unit: "%", goodDirection: "DOWN", inputType: "PERCENT", dashboard: true },
  { name: "成約率", unit: "%", inputType: "PERCENT", dashboard: true },
  { name: "平均窓口単価", unit: "円" },
];

// ===== KDI 初期テンプレート定義 =====
type KdiDef = { name: string; category: string; relatedKpiName?: string; frequency?: string };

const SEIKOTSU_KDI: KdiDef[] = [
  ...["問診ロープレ", "クロージングロープレ", "初診前アドバイス", "2回目問診", "AIチェック", "初診振り返り"].map(
    (name) => ({ name, category: "成約率関連", relatedKpiName: "成約率", frequency: "DAILY" })
  ),
  ...["離反予測者の後追い", "LINE送信", "予約確保", "カルテ会議", "通院指導", "担当者別確認"].map((name) => ({
    name,
    category: "離反率関連",
    relatedKpiName: "離反率",
    frequency: "WEEKLY1",
  })),
  ...["候補リスト確認", "トライアル説明ロープレ", "楽トレ説明ロープレ", "更新確認", "誘導確認", "効果説明練習"].map(
    (name) => ({ name, category: "楽トレ関連", relatedKpiName: "楽トレ", frequency: "WEEKLY1" })
  ),
  ...["骨盤検査", "候補者管理", "誘導練習", "頻度確認", "カルテ枚数確認"].map((name) => ({
    name,
    category: "骨盤関連",
    relatedKpiName: "骨盤",
    frequency: "WEEKLY1",
  })),
];

const ESTHE_KDI: KdiDef[] = [
  ...["カウンセリングロープレ", "クロージングロープレ", "初回体験後フォロー", "ホットペッパー導線確認", "口コミ依頼", "ビフォーアフター確認"].map(
    (name) => ({ name, category: "新規・契約関連", relatedKpiName: "契約数", frequency: "WEEKLY1" })
  ),
  ...["次回予約促し", "LINEフォロー", "継続提案", "休眠顧客掘り起こし", "来店頻度確認"].map((name) => ({
    name,
    category: "離反関連",
    relatedKpiName: "離反率",
    frequency: "WEEKLY1",
  })),
  ...["プレミアム提案練習", "定額提案練習", "物販提案練習", "悩み別メニュー提案"].map((name) => ({
    name,
    category: "単価関連",
    relatedKpiName: "平均窓口単価",
    frequency: "WEEKLY1",
  })),
];

const SHINKYU_KDI: KdiDef[] = [
  ...["美容鍼カウンセリングロープレ", "効果説明ロープレ", "回数券提案練習", "定額提案練習", "初回後フォロー"].map(
    (name) => ({ name, category: "新規・契約関連", relatedKpiName: "契約数", frequency: "WEEKLY1" })
  ),
  ...["次回予約促し", "LINEフォロー", "通院目的の再確認", "来店頻度確認"].map((name) => ({
    name,
    category: "離反関連",
    relatedKpiName: "離反率",
    frequency: "WEEKLY1",
  })),
  ...["美容鍼追加提案", "回数券提案", "定額提案", "悩み別施術提案"].map((name) => ({
    name,
    category: "単価関連",
    relatedKpiName: "平均窓口単価",
    frequency: "WEEKLY1",
  })),
];

async function clearAll() {
  // 依存関係の逆順で削除
  await prisma.actionProgress.deleteMany();
  await prisma.reportAction.deleteMany();
  await prisma.reportKdi.deleteMany();
  await prisma.reportInflow.deleteMany();
  await prisma.reportKpiValue.deleteMany();
  await prisma.feedback.deleteMany();
  await prisma.report.deleteMany();
  await prisma.alertCondition.deleteMany();
  await prisma.successAction.deleteMany();
  await prisma.kpiItem.deleteMany();
  await prisma.kdiItem.deleteMany();
  await prisma.user.deleteMany();
  await prisma.department.deleteMany();
  await prisma.store.deleteMany();
  await prisma.setting.deleteMany();
}

async function main() {
  console.log("🌱 シード開始...");
  await clearAll();

  const pw = await bcrypt.hash("password123", 10);

  // ===== 業態別 KPI テンプレート =====
  async function createKpiTemplate(businessType: string, defs: KpiDef[]) {
    await prisma.kpiItem.createMany({
      data: defs.map((d, i) => ({
        name: d.name,
        businessType,
        unit: d.unit,
        inputType: d.inputType ?? (d.unit === "%" ? "PERCENT" : "NUMBER"),
        goodDirection: d.goodDirection ?? "UP",
        showDashboard: d.dashboard ?? false,
        sortOrder: i,
      })),
    });
  }
  await createKpiTemplate("SEIKOTSU", SEIKOTSU_KPI);
  await createKpiTemplate("ESTHE", ESTHE_KPI);
  await createKpiTemplate("SHINKYU", SHINKYU_KPI);

  // ===== 業態別 KDI テンプレート =====
  async function createKdiTemplate(businessType: string, defs: KdiDef[]) {
    await prisma.kdiItem.createMany({
      data: defs.map((d, i) => ({
        name: d.name,
        category: d.category,
        businessType,
        relatedKpiName: d.relatedKpiName,
        recommendedFrequency: d.frequency ?? "WEEKLY1",
        sortOrder: i,
      })),
    });
  }
  await createKdiTemplate("SEIKOTSU", SEIKOTSU_KDI);
  await createKdiTemplate("ESTHE", ESTHE_KDI);
  await createKdiTemplate("SHINKYU", SHINKYU_KDI);

  // ===== 店舗 =====
  const honin = await prisma.store.create({
    data: { name: "溝の口本院", businessType: "SEIKOTSU", area: "溝の口エリア", directorName: "佐藤 院長", managerName: "佐藤 院長", status: "ACTIVE", sortOrder: 1, openDate: new Date("2018-04-01") },
  });
  const bunin = await prisma.store.create({
    data: { name: "溝の口分院", businessType: "SEIKOTSU", area: "溝の口エリア", directorName: "鈴木 院長", managerName: "鈴木 院長", status: "ACTIVE", sortOrder: 2, openDate: new Date("2020-06-01") },
  });
  const komazawa = await prisma.store.create({
    data: { name: "駒沢大学駅院", businessType: "SEIKOTSU", area: "世田谷エリア", directorName: "高橋 院長", managerName: "高橋 院長", status: "ACTIVE", sortOrder: 3, openDate: new Date("2021-09-01") },
  });
  const estheMizo = await prisma.store.create({
    data: { name: "エステ溝の口", businessType: "ESTHE", area: "溝の口エリア", directorName: "田中 責任者", managerName: "田中 責任者", status: "ACTIVE", sortOrder: 4, openDate: new Date("2022-03-01") },
  });
  const machida = await prisma.store.create({
    data: { name: "町田", businessType: "COMPLEX", area: "町田エリア", directorName: "山本 店長", managerName: "山本 店長", status: "ACTIVE", sortOrder: 5, openDate: new Date("2019-11-01") },
  });

  // ===== 町田の部門 =====
  const machidaEsthe = await prisma.department.create({ data: { storeId: machida.id, name: "エステ", businessType: "ESTHE", managerName: "伊藤 エステ責任者", sortOrder: 1 } });
  const machidaShinkyu = await prisma.department.create({ data: { storeId: machida.id, name: "鍼灸", businessType: "SHINKYU", managerName: "渡辺 鍼灸責任者", sortOrder: 2 } });
  const machidaSeikotsu = await prisma.department.create({ data: { storeId: machida.id, name: "整骨院", businessType: "SEIKOTSU", managerName: "中村 整骨院責任者", sortOrder: 3 } });

  // ===== ユーザー =====
  const area = await prisma.user.create({
    data: { email: "admin@example.com", passwordHash: pw, name: "エリアマネージャー", role: "AREA_MANAGER" },
  });
  // 実ユーザーのメールでもログインできるように
  await prisma.user.create({
    data: { email: "k.yuji19951007@gmail.com", passwordHash: pw, name: "エリアマネージャー（あなた）", role: "AREA_MANAGER" },
  });

  await prisma.user.create({ data: { email: "honin@example.com", passwordHash: pw, name: "佐藤 院長", role: "STORE_MANAGER", storeId: honin.id } });
  await prisma.user.create({ data: { email: "bunin@example.com", passwordHash: pw, name: "鈴木 院長", role: "STORE_MANAGER", storeId: bunin.id } });
  await prisma.user.create({ data: { email: "komazawa@example.com", passwordHash: pw, name: "高橋 院長", role: "STORE_MANAGER", storeId: komazawa.id } });
  await prisma.user.create({ data: { email: "esthe@example.com", passwordHash: pw, name: "田中 責任者", role: "STORE_MANAGER", storeId: estheMizo.id } });
  await prisma.user.create({ data: { email: "machida@example.com", passwordHash: pw, name: "山本 店長", role: "STORE_MANAGER", storeId: machida.id } });
  await prisma.user.create({ data: { email: "machida-esthe@example.com", passwordHash: pw, name: "伊藤 エステ責任者", role: "DEPARTMENT_MANAGER", storeId: machida.id, departmentId: machidaEsthe.id } });
  await prisma.user.create({ data: { email: "machida-shinkyu@example.com", passwordHash: pw, name: "渡辺 鍼灸責任者", role: "DEPARTMENT_MANAGER", storeId: machida.id, departmentId: machidaShinkyu.id } });
  await prisma.user.create({ data: { email: "machida-seikotsu@example.com", passwordHash: pw, name: "中村 整骨院責任者", role: "DEPARTMENT_MANAGER", storeId: machida.id, departmentId: machidaSeikotsu.id } });

  // ===== 要注意条件（サンプル） =====
  await prisma.alertCondition.createMany({
    data: [
      { name: "離反率が20%以上", targetType: "ALL", targetKpi: "離反率", operator: "GTE", threshold: 20, color: "RED", priority: "HIGH", notify: true, sortOrder: 1 },
      { name: "成約率が50%未満", targetType: "ALL", targetKpi: "成約率", operator: "LT", threshold: 50, color: "YELLOW", priority: "MID", notify: true, sortOrder: 2 },
      { name: "売上が目標未達", targetType: "ALL", targetKpi: "売上", operator: "BELOW_TARGET", color: "YELLOW", priority: "MID", notify: false, sortOrder: 3 },
      { name: "会員数が前回より減少", targetType: "SEIKOTSU", targetKpi: "会員数", operator: "DECREASED", color: "BLUE", priority: "LOW", notify: false, sortOrder: 4 },
      { name: "週次報告が未提出", targetType: "ALL", operator: "NOT_SUBMITTED", color: "RED", priority: "HIGH", notify: true, sortOrder: 5 },
    ],
  });

  // ===== 設定デフォルト =====
  await prisma.setting.createMany({
    data: [
      { key: "weeklyDeadlineDay", value: "1" },
      { key: "weeklyDeadlineTime", value: "18:00" },
      { key: "monthlyDeadlineDay", value: "5" },
      { key: "unsubmittedNotifyTime", value: "10:00" },
      { key: "lineEnabled", value: "false" },
      { key: "sheetsEnabled", value: "false" },
      { key: "aiEnabled", value: "true" },
      { key: "alertNotifyEnabled", value: "true" },
    ],
  });

  // ===== サンプル報告（溝の口本院: 前週 + 今週） =====
  const honinKpis = await prisma.kpiItem.findMany({ where: { businessType: "SEIKOTSU" }, orderBy: { sortOrder: "asc" } });
  const kpiByName = new Map(honinKpis.map((k) => [k.name, k]));

  // 前週の値
  const prevVals: Record<string, { target?: number; current?: number; forecast?: number }> = {
    売上: { target: 3000000, current: 2650000, forecast: 2800000 },
    初診数: { target: 40, current: 33, forecast: 36 },
    会員数: { target: 320, current: 308 },
    カルテ枚数: { target: 900, current: 870 },
    離反率: { target: 15, current: 33.6 },
    成約率: { target: 60, current: 53.3 },
    楽トレ: { target: 400000, current: 350000 },
    骨盤: { target: 300000, current: 280000 },
  };
  // 今週の値（改善 / 一部悪化）
  const currVals: Record<string, { target?: number; current?: number; forecast?: number }> = {
    売上: { target: 3000000, current: 2880000, forecast: 3000000 },
    初診数: { target: 40, current: 38, forecast: 41 },
    会員数: { target: 320, current: 312 },
    カルテ枚数: { target: 900, current: 905 },
    離反率: { target: 15, current: 35.0 },
    成約率: { target: 60, current: 60.0 },
    楽トレ: { target: 400000, current: 395000 },
    骨盤: { target: 300000, current: 295000 },
  };

  const reporter = await prisma.user.findUnique({ where: { email: "honin@example.com" } });

  // 前週レポート
  const prevReport = await prisma.report.create({
    data: {
      storeId: honin.id,
      reporterId: reporter!.id,
      reportType: "WEEKLY",
      targetWeek: "2026-W25",
      status: "SUBMITTED",
      submittedAt: new Date("2026-06-16T18:00:00"),
      goodPoints: "初診からの成約が安定してきた。",
      badPoints: "離反率が高止まり。",
      dataIssues: "離反率33.6%は要改善。予約確保率が低い。",
      kpiValues: {
        create: honinKpis
          .filter((k) => prevVals[k.name])
          .map((k) => ({ kpiItemId: k.id, kpiName: k.name, unit: k.unit, ...prevVals[k.name] })),
      },
    },
  });

  // 前週のAction（=今週の「前回Action」になる）
  const action1 = await prisma.reportAction.create({
    data: {
      reportId: prevReport.id,
      content: "問診ロープレを毎日実施し、初診のクロージング精度を上げる",
      relatedKpiName: "成約率",
      assignee: "佐藤 院長",
      deadline: "2026-06-23",
      frequency: "DAILY",
      expectedEffect: "成約率を60%まで引き上げる",
      successCondition: "毎日1回以上ロープレを実施、成約率55%以上",
    },
  });
  const action2 = await prisma.reportAction.create({
    data: {
      reportId: prevReport.id,
      content: "離反予測者へのLINEフォローと予約確保を徹底する",
      relatedKpiName: "離反率",
      assignee: "受付チーム",
      deadline: "2026-06-23",
      frequency: "WEEKLY2",
      expectedEffect: "離反率を30%以下に下げる",
      successCondition: "離反予測者の80%に予約を確保",
    },
  });

  // 今週レポート
  const currReport = await prisma.report.create({
    data: {
      storeId: honin.id,
      reporterId: reporter!.id,
      reportType: "WEEKLY",
      targetWeek: "2026-W26",
      status: "SUBMITTED",
      submittedAt: new Date("2026-06-23T18:00:00"),
      goodPoints: "問診ロープレの効果で成約率が改善。",
      badPoints: "離反率がやや悪化。LINEフォローはしたが予約確保が弱い。",
      dataIssues: "離反率が33.6→35.0と悪化。予約確保率に課題。",
      doneThings: "問診ロープレを毎日実施。",
      notDoneThings: "離反予測者の予約確保が一部未実施。",
      kpiValues: {
        create: honinKpis
          .filter((k) => currVals[k.name])
          .map((k) => ({ kpiItemId: k.id, kpiName: k.name, unit: k.unit, ...currVals[k.name] })),
      },
      inflows: {
        create: [
          { channel: "ホットペッパー", count: 12 },
          { channel: "Google", count: 18 },
          { channel: "紹介", count: 6 },
        ],
      },
      kdis: {
        create: [
          { name: "問診ロープレ", relatedKpiName: "成約率", assignee: "佐藤 院長", frequency: "DAILY", count: 7, status: "COMPLETED", comment: "毎日実施できた" },
          { name: "予約確保", relatedKpiName: "離反率", assignee: "受付チーム", frequency: "WEEKLY2", count: 1, status: "PARTIAL", comment: "後追いが追いつかなかった" },
        ],
      },
      actions: {
        create: [
          { content: "離反予測者リストを作り、担当者別に予約確保を割り当てる", relatedKpiName: "離反率", assignee: "受付チーム", deadline: "2026-06-30", frequency: "DAILY", expectedEffect: "離反率を30%以下に", successCondition: "予約確保率80%以上" },
          { content: "楽トレ更新確認を週1で実施", relatedKpiName: "楽トレ", assignee: "佐藤 院長", deadline: "2026-06-30", frequency: "WEEKLY1", expectedEffect: "楽トレ売上40万円達成", successCondition: "更新対象者の全員に声かけ" },
        ],
      },
    },
  });

  // 今週レポートに「前回Action進捗」を登録
  await prisma.actionProgress.create({
    data: {
      reportId: currReport.id,
      previousActionId: action1.id,
      status: "COMPLETED",
      comment: "毎日ロープレを実施。成約率が53.3%→60.0%に改善。",
      prevKpiValue: 53.3,
      currentKpiValue: 60.0,
      diff: 6.7,
    },
  });
  await prisma.actionProgress.create({
    data: {
      reportId: currReport.id,
      previousActionId: action2.id,
      status: "PARTIAL",
      comment: "LINEフォローは実施したが予約確保が追いつかず、離反率は33.6%→35.0%と悪化。",
      prevKpiValue: 33.6,
      currentKpiValue: 35.0,
      diff: 1.4,
    },
  });

  // フィードバック（未送信）
  await prisma.feedback.create({
    data: {
      reportId: currReport.id,
      aiContent: null,
      editedContent: null,
      sendStatus: "UNSENT",
    },
  });

  // 成功Action履歴（成約率改善の例）
  await prisma.successAction.create({
    data: {
      storeId: honin.id,
      businessType: "SEIKOTSU",
      content: "問診ロープレを毎日実施",
      relatedKpi: "成約率",
      beforeValue: 53.3,
      afterValue: 60.0,
      diff: 6.7,
      reasonComment: "初診クロージングの型が固まり、成約率が改善した。",
    },
  });

  // 他店舗にも今週の提出を1件ずつ（ダッシュボード用）。エステ溝の口は未提出のまま。
  async function quickReport(store: { id: string }, businessType: string, vals: Record<string, number>) {
    const kpis = await prisma.kpiItem.findMany({ where: { businessType } });
    const map = new Map(kpis.map((k) => [k.name, k]));
    await prisma.report.create({
      data: {
        storeId: store.id,
        reporterId: area.id,
        reportType: "WEEKLY",
        targetWeek: "2026-W26",
        status: "SUBMITTED",
        kpiValues: {
          create: Object.entries(vals)
            .filter(([name]) => map.has(name))
            .map(([name, current]) => ({ kpiItemId: map.get(name)!.id, kpiName: name, unit: map.get(name)!.unit, current, target: name === "売上" ? 2500000 : undefined })),
        },
      },
    });
  }
  await quickReport(bunin, "SEIKOTSU", { 売上: 2100000, 初診数: 25, 会員数: 240, カルテ枚数: 650, 離反率: 18.5, 成約率: 58 });
  await quickReport(komazawa, "SEIKOTSU", { 売上: 1850000, 初診数: 22, 会員数: 210, カルテ枚数: 600, 離反率: 22.0, 成約率: 45 });
  // 町田の部門別レポート（エステ提出済 / 鍼灸未提出 / 整骨院提出済）
  async function deptReport(deptId: string, businessType: string, vals: Record<string, number>) {
    const kpis = await prisma.kpiItem.findMany({ where: { businessType } });
    const map = new Map(kpis.map((k) => [k.name, k]));
    await prisma.report.create({
      data: {
        storeId: machida.id,
        departmentId: deptId,
        reporterId: area.id,
        reportType: "WEEKLY",
        targetWeek: "2026-W26",
        status: "SUBMITTED",
        kpiValues: {
          create: Object.entries(vals)
            .filter(([name]) => map.has(name))
            .map(([name, current]) => ({ kpiItemId: map.get(name)!.id, kpiName: name, unit: map.get(name)!.unit, current })),
        },
      },
    });
  }
  await deptReport(machidaEsthe.id, "ESTHE", { 売上: 1200000, 新規数: 14, 契約数: 9, 離反率: 16, 成約率: 62, 平均窓口単価: 12000 });
  await deptReport(machidaSeikotsu.id, "SEIKOTSU", { 売上: 1400000, 初診数: 18, 会員数: 160, 離反率: 19, 成約率: 55 });
  // 町田 鍼灸 / エステ溝の口 は未提出（ダッシュボードの未提出表示用）

  console.log("✅ シード完了");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
