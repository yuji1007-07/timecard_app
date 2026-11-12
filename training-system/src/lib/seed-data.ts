import type { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { ALL_STORES } from "./constants";
import { detectBrandAndStore, normalizeText } from "./stores";

export const DEFAULT_ADMIN_LOGIN_ID = "admin";
export const DEFAULT_ADMIN_PASSWORD = "admin1234";

type SeedQuestion = { text: string; choices: [string, string, string, string]; explanation: string };
type SeedVideo = {
  title: string;
  durationSec: number;
  category: string;
  audience: string;
  requiredScope: string;
  questions: SeedQuestion[]; // choices の1つ目が正解
};

/** 初期登録する動画とテスト問題。YouTube の URL は管理画面から後で入れる（空の間は「準備中」） */
const SEED_VIDEOS: SeedVideo[] = [
  {
    title: "売上を上げるコツ（整骨編）",
    durationSec: 5 * 60 + 15,
    category: "SEIKOTSU",
    audience: "LEADERS",
    requiredScope: "ALL",
    questions: [
      {
        text: "「カルテ枚数」に入るのは？",
        choices: ["その月に売上が立った人全員（会員・回数券・単発すべて）", "その月に来院した人だけ", "会員だけ", "新規の人だけ"],
        explanation: "基準は「来ているか」ではなく「売上が立ったか」。月会費の支払いがある会員は、来院がなくても入る。",
      },
      {
        text: "「離反」とは？",
        choices: ["先月は売上が立っていたのに、今月は売上が立たなかった人", "今月来院しなかった人全員", "解約した会員だけ", "3ヶ月来ていない人"],
        explanation: "先月と今月の「売上が立ったか」で判断する。",
      },
      {
        text: "売上の公式は？",
        choices: ["カルテ枚数 × 来店頻度 × 単価", "新規数 × 単価", "総来店数 × 来店頻度", "カルテ枚数 × 単価 ÷ 来店頻度"],
        explanation: "売上を上げる方法は「人を増やす」「来てもらう回数を増やす」「1回の価値を上げる」の3つだけ。",
      },
      {
        text: "「純増」の計算は？",
        choices: ["流入（新規・再診）− 離反", "新規 − 離反", "今月のカルテ枚数 − 先月の売上", "再診 ＋ 新規"],
        explanation: "人が入ってきても、離反が多いとカルテは増えない。",
      },
      {
        text: "A院の10月は離反62人、9月のカルテは267人。離反率はおよそ？",
        choices: ["23%", "19%", "27%", "62%"],
        explanation: "離反率 ＝ 離反数 ÷ 先月のカルテ枚数。62 ÷ 267 ≒ 23%。",
      },
    ],
  },
  {
    title: "売上を上げるコツ（エステ編）",
    durationSec: 4 * 60 + 59,
    category: "ESTHE",
    audience: "LEADERS",
    requiredScope: "ALL",
    questions: [
      {
        text: "「来店頻度」の計算は？",
        choices: ["総来店数 ÷ カルテ枚数", "売上 ÷ 総来店数", "カルテ枚数 ÷ 総来店数", "新規数 ÷ カルテ枚数"],
        explanation: "1人が月に何回来てくれたか、を表す数字。",
      },
      {
        text: "A店の10月は、カルテ93人・来店頻度1.44回・単価13,426円。売上はおよそ？",
        choices: ["179.9万円", "134.3万円", "199.9万円", "124.6万円"],
        explanation: "93 × 1.44 × 13,426円 ≒ 約180万円。月次資料の実績（179.9万円）とほぼ一致する。",
      },
      {
        text: "9月よりカルテが20人増えたのに、売上が6万円しか増えなかった理由は？",
        choices: ["来店頻度と単価が下がったから", "離反が増えたから", "新規が減ったから", "プリカが売れなかったから"],
        explanation: "売上は3つの数字のかけ算。1つ増えても、ほかが下がると伸びない。",
      },
      {
        text: "11月予算に含まれるプリカ（143.6万円）の考え方は？",
        choices: ["一時的な売上なので分けて考え、残りを3つの数字で作る", "来月も同じだけ売れる前提で計算する", "単価に含めて考える", "予算から外して無視する"],
        explanation: "残りの255.7万円を、カルテ・来店頻度・単価で作る。",
      },
      {
        text: "ダイエットで、結果も売上も作る一番のカギは？",
        choices: ["通ってもらう回数（来店頻度）", "新規の数", "単価を上げること", "広告を増やすこと"],
        explanation: "毎回の施術後に次回予約。コースは最初に「週1回ペース」を約束する。",
      },
    ],
  },
  {
    title: "売上を上げるコツ（鍼灸編）",
    durationSec: 5 * 60 + 6,
    category: "SHINKYU",
    audience: "LEADERS",
    requiredScope: "ALL",
    questions: [
      {
        text: "「単価」の計算は？",
        choices: ["売上 ÷ 総来店数", "売上 ÷ カルテ枚数", "総来店数 ÷ カルテ枚数", "売上 × 来店頻度"],
        explanation: "1回の来店で、いくらの価値を届けられたか。",
      },
      {
        text: "10月は予算を108%で達成。3ヶ月の中身を見るとどうだった？",
        choices: ["カルテが99人→89人に減り、単価が上がって売上を保っていた", "カルテも単価も増えていた", "来店頻度が大きく上がっていた", "新規が大きく増えていた"],
        explanation: "売上が横ばいでも、中身を分解して見る。人が減り続けると、いずれ売上も下がる。",
      },
      {
        text: "10月は新規26人のうち4人が契約。契約率はおよそ？",
        choices: ["15%", "4%", "26%", "33%"],
        explanation: "4 ÷ 26 ≒ 15%。9月の33%から下がっている。",
      },
      {
        text: "11月の予算達成のために、まず動かす数字は？",
        choices: ["新定額の方の来店頻度（月にあと0.4回）", "単価を大きく上げる", "新規を2倍にする", "カルテを30人増やす"],
        explanation: "新定額36人が月0.4回ずつ多く来ると、来店が約14回増えて予算に届く。",
      },
      {
        text: "新定額の方への次回予約の取り方として正しいのは？",
        choices: ["毎回「次は1週間後」と、理由を添えて次回予約を取る", "来たいときに予約してもらう", "月末にまとめて連絡する", "回数券が切れたら案内する"],
        explanation: "「通う理由」を伝えることが、来店頻度も契約率も上げる。",
      },
    ],
  },
  {
    title: "社長の宿題 PDCAの書き方",
    durationSec: 13 * 60 + 27,
    category: "COMMON",
    audience: "ALL",
    requiredScope: "LEADERS",
    questions: [
      {
        text: "社長の宿題の「合格ライン」は？",
        choices: ["読んだ人が、来月同じ行動を再現できること", "予算を達成していること", "A4で1枚に収まっていること", "数字がたくさん書いてあること"],
        explanation: "書いた本人にしか分からない報告書だと、他のスタッフも真似できない。",
      },
      {
        text: "Pに書くべきものは？",
        choices: ["どのKPIを、いくつからいくつに動かすか（計画）", "予算の金額と内訳だけ", "先月の反省", "がんばる気持ち"],
        explanation: "金額は「目標」。どうやって作るかまで書いて「計画」になる。",
      },
      {
        text: "Dの書き方として正しいのは？",
        choices: [
          "朝礼で口コミ候補を毎日3名共有。9月は42名に依頼し、口コミ＋16件",
          "口コミ150件を目標に集め、初診数増加を目指す",
          "口コミのお願いを徹底する",
          "満足度が高い方に積極的にお願いする",
        ],
        explanation: "Dは「実際にやったこと」を数と完了まで書く。「目指す」「徹底する」などは気持ちのサイン。",
      },
      {
        text: "Cを書く順番は？",
        choices: ["数字 → 分解 → 原因", "原因 → 数字 → 反省", "反省 → 目標 → 数字", "分解 → 目標 → 原因"],
        explanation: "Dでやったこと1つずつに「狙ったKPIは動いたか」を答え合わせする。",
      },
      {
        text: "Aに書くべきことは？",
        choices: ["できなかった理由を潰す仕組みと、KPIがどれだけ動くかの見込み", "「もっと積極的にやる」という決意", "来月の予算額", "できなかった人の名前"],
        explanation: "予想が外れても大丈夫。ズレが翌月のCの材料になる。",
      },
    ],
  },
];

/**
 * 初期データ投入（店舗マスタ・admin・初期動画4本とテスト問題）。
 * 既にあるデータは変更も削除もしない（何度実行しても安全）。
 *  - 店舗: 同じ名前があればスキップ
 *  - admin: 既にあればスキップ
 *  - 動画: 同じタイトルがあればスキップ（問題も触らない）
 */
export async function seedDatabase(prisma: PrismaClient): Promise<{ stores: number; admin: boolean; videos: number }> {
  let created = 0;
  let order = 0;
  for (const displayName of ALL_STORES) {
    order += 1;
    const name = normalizeText(displayName);
    const exists = await prisma.store.findUnique({ where: { name } });
    if (exists) continue;
    const { brand, shortName } = detectBrandAndStore(name);
    await prisma.store.create({ data: { name, brand, shortName, isActive: true, sortOrder: order } });
    created += 1;
  }

  let adminCreated = false;
  const admin = await prisma.user.findUnique({ where: { loginId: DEFAULT_ADMIN_LOGIN_ID } });
  if (!admin) {
    const hq = await prisma.store.findFirst({ where: { isActive: true }, orderBy: { sortOrder: "asc" } });
    await prisma.user.create({
      data: {
        loginId: DEFAULT_ADMIN_LOGIN_ID,
        passwordHash: await bcrypt.hash(DEFAULT_ADMIN_PASSWORD, 10),
        name: "本部管理者",
        role: "ADMIN",
        position: "STAFF",
        storeId: hq?.id ?? null,
      },
    });
    adminCreated = true;
  }

  let videos = 0;
  let videoOrder = 0;
  for (const v of SEED_VIDEOS) {
    videoOrder += 10;
    const exists = await prisma.video.findFirst({ where: { title: v.title } });
    if (exists) continue;
    await prisma.video.create({
      data: {
        title: v.title,
        youtubeUrl: "",
        durationSec: v.durationSec,
        category: v.category,
        audience: v.audience,
        requiredScope: v.requiredScope,
        sortOrder: videoOrder,
        isPublished: true,
        questions: {
          create: v.questions.map((q, i) => ({
            sortOrder: i + 1,
            text: q.text,
            choices: q.choices,
            correctIndex: 0, // 表示するときに毎回シャッフルする
            explanation: q.explanation,
          })),
        },
      },
    });
    videos += 1;
  }

  return { stores: created, admin: adminCreated, videos };
}
