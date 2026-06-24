import OpenAI from "openai";
import { getSetting } from "@/lib/settings";

export function isOpenAIConfigured(): boolean {
  return !!process.env.OPENAI_API_KEY;
}

export type FeedbackContext = {
  storeName: string;
  departmentName?: string | null;
  businessType: string;
  reportType: string;
  kpiDiffSummary: string; // KPI差分の整形済みテキスト
  prevKdiSummary: string; // 前回KDI進捗
  currentKdiSummary: string; // 今回KDI
  kdiConsistency: string; // KDI整合性チェック結果
  alertSummary: string; // 要注意該当
  review: string; // 先週振り返り
};

const SYSTEM_PROMPT = `あなたは整骨院・鍼灸・エステを運営するグループのエリアマネージャーです。
各店舗責任者の週次/月次報告を読み、現場向けの前向きで具体的なフィードバックを作成します。
トーン: 前向き / 具体的 / 数値根拠あり / 責めない / 厳しさはあるが人格否定しない。
必ず以下の見出し構成で出力してください。

1. 良かった点
2. 改善点
3. 数値から見た課題
4. 前回KDIの進捗評価
5. 今回KDIの整合性
6. 来週優先すべきAction（3つ）
7. 責任者へ送る返信文（LINEやチャットでそのまま送れる自然な文章）`;

export function buildUserPrompt(ctx: FeedbackContext): string {
  return `【店舗】${ctx.storeName}${ctx.departmentName ? ` / ${ctx.departmentName}` : ""}（業態: ${ctx.businessType}）
【報告区分】${ctx.reportType}

■ 先週の振り返り
${ctx.review || "（記載なし）"}

■ KPI差分
${ctx.kpiDiffSummary || "（データなし）"}

■ 前回KDI/Actionの進捗
${ctx.prevKdiSummary || "（前回Actionなし）"}

■ 今回のKDI/Action
${ctx.currentKdiSummary || "（記載なし）"}

■ KDI整合性チェック結果
${ctx.kdiConsistency || "（なし）"}

■ 要注意条件の該当状況
${ctx.alertSummary || "（該当なし）"}

上記をもとに、エリアマネージャーとして責任者に伝えるフィードバックを作成してください。`;
}

/**
 * AIフィードバックを生成する。APIキーが無い場合はテンプレ下書きを返す。
 */
export async function generateFeedback(ctx: FeedbackContext): Promise<{ content: string; usedAI: boolean }> {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = (await getSetting("openaiModel")) || process.env.OPENAI_MODEL || "gpt-4o-mini";

  if (!apiKey) {
    return { content: fallbackDraft(ctx), usedAI: false };
  }

  try {
    const client = new OpenAI({ apiKey });
    const completion = await client.chat.completions.create({
      model,
      temperature: 0.6,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: buildUserPrompt(ctx) },
      ],
    });
    const content = completion.choices[0]?.message?.content?.trim() || fallbackDraft(ctx);
    return { content, usedAI: true };
  } catch (e) {
    return {
      content: `【AI生成に失敗しました】${(e as Error).message}\n\n` + fallbackDraft(ctx),
      usedAI: false,
    };
  }
}

/** APIキー未設定時のフォールバック下書き（構成は本番と同じ）。 */
function fallbackDraft(ctx: FeedbackContext): string {
  return `※ OpenAI APIキーが未設定のため、テンプレート下書きを表示しています。設定画面でキーを登録すると自動生成されます。

1. 良かった点
${ctx.storeName}の報告を確認しました。提出ありがとうございます。

2. 改善点
KPI差分を踏まえ、改善余地のある項目を整理しましょう。

3. 数値から見た課題
${ctx.kpiDiffSummary || "（KPIデータを入力してください）"}

4. 前回KDIの進捗評価
${ctx.prevKdiSummary || "（前回Actionの進捗が未入力です）"}

5. 今回KDIの整合性
${ctx.kdiConsistency || "（KDI整合性チェック結果を確認してください）"}

6. 来週優先すべきAction
- 未達KPIに直結するActionを設定する
- 担当者・期限を明確にする
- 前回未完了のActionを完了させる

7. 責任者へ送る返信文
お疲れさまです。今週も報告ありがとうございます。数値を一緒に確認しながら、来週の重点ポイントを決めていきましょう。引き続きよろしくお願いします。`;
}
