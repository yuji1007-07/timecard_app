// ============================================================
// home.js … トップ画面
// 「新しい申込書を作成」「申込履歴」「テンプレート管理」への入口
// ============================================================

import { getApplications, getTemplates } from "../storage.js";

export function render(container) {
  const apps = getApplications().length;
  const templates = getTemplates().length;

  container.innerHTML = `
    <section class="hero">
      <h1 class="hero__title">会員入会申込書アプリ</h1>
      <p class="hero__subtitle">iPadで申込書を表示・サイン・PDF印刷まで完結</p>
    </section>

    <div class="home-grid">
      <a href="#/select" class="home-card home-card--primary">
        <div class="home-card__icon">📝</div>
        <div class="home-card__title">新しい申込書を作成</div>
        <div class="home-card__desc">テンプレートを選んで入力を始めます</div>
      </a>

      <a href="#/history" class="home-card">
        <div class="home-card__icon">📁</div>
        <div class="home-card__title">申込履歴</div>
        <div class="home-card__desc">作成済み ${apps} 件 / 検索・PDF確認</div>
      </a>

      <a href="#/templates" class="home-card">
        <div class="home-card__icon">⚙️</div>
        <div class="home-card__title">テンプレート管理</div>
        <div class="home-card__desc">登録 ${templates} 種類 / 作成・編集</div>
      </a>
    </div>

    <p class="home-note">
      ※ データはこのiPadのブラウザ内に保存されます。受付での試験運用にご利用ください。
    </p>
  `;
}
