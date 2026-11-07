"use client";

// 顧客管理ページ（旧アプリ customerManage.js の移植）
// 申込履歴を「店舗別・カルテ番号順」で一覧表示します。同じ患者様（カルテ番号）の申込書がまとまって並びます。
// カルテ番号・氏名で検索でき、表示中の申込書をまとめてPDF化しZIPで保存できます。

import { useMemo, useState } from "react";
import Link from "next/link";
import Script from "next/script";
import { formatDateJa } from "@/lib/format";
import { fieldVal, type ApplicationListItem } from "@/lib/types";
import { BACKUP_SCRIPTS, downloadBlob, exportAppsToZip } from "@/lib/backup";
import { fetchApplicationsForBackup } from "./actions";

export function CustomerList({ apps: allApps, storeLocked }: { apps: ApplicationListItem[]; storeLocked: boolean }) {
  const [keyword, setKeyword] = useState("");
  const [store, setStore] = useState("");
  const [busy, setBusy] = useState(false);
  const [btnText, setBtnText] = useState("📦 PDFをまとめてZIP保存");
  const [msg, setMsg] = useState("");

  const chartNo = (a: ApplicationListItem) => fieldVal(a, "カルテ");
  const name = (a: ApplicationListItem) => fieldVal(a, "氏名") || fieldVal(a, "名前") || "（無記名）";
  const kana = (a: ApplicationListItem) => fieldVal(a, "フリガナ");

  // 店舗の選択肢
  const storeNames = useMemo(
    () => Array.from(new Set(allApps.map((a) => a.storeName || "（店舗未設定）"))).sort((a, b) => a.localeCompare(b, "ja")),
    [allApps]
  );

  // 検索で絞り込み
  const currentApps = allApps.filter((a) => {
    if (store && (a.storeName || "") !== store) return false;
    if (keyword) {
      const kw = keyword.toLowerCase();
      const hit = (chartNo(a) + name(a) + kana(a)).toLowerCase().includes(kw);
      if (!hit) return false;
    }
    return true;
  });

  // 店舗ごとにグループ分け。店舗名で並べ、各店舗内は「カルテ番号 → 申込日」の順
  const byStore: Record<string, ApplicationListItem[]> = {};
  for (const a of currentApps) {
    const s = a.storeName || "（店舗未設定）";
    (byStore[s] = byStore[s] || []).push(a);
  }
  const groupNames = Object.keys(byStore).sort((a, b) => a.localeCompare(b, "ja"));

  // 📦 表示中の申込書を全部PDFにしてZIPでダウンロード
  async function backup() {
    if (currentApps.length === 0) {
      setMsg("保存する申込書がありません。");
      return;
    }
    const label = store ? `「${store}」` : "全店舗";
    if (!confirm(`${label}の表示中 ${currentApps.length}件 をPDFにまとめてZIPで保存します。\n件数が多いと数十秒かかることがあります。よろしいですか？`)) {
      return;
    }
    setBusy(true);
    try {
      setMsg("申込書データを取得中…");
      const full = await fetchApplicationsForBackup(currentApps.map((a) => a.id));
      const blob = await exportAppsToZip(full, (done, total) => {
        setMsg(`PDF作成中… ${done} / ${total} 件`);
        setBtnText(`作成中… ${done}/${total}`);
      });
      const today = new Date().toISOString().slice(0, 10);
      const storeTag = store ? "_" + store : "";
      downloadBlob(blob, `申込書バックアップ${storeTag}_${today}.zip`);
      setMsg(`✅ ${full.length}件をZIPで保存しました。（必要ならGoogleドライブへアップロードしてください）`);
    } catch (e) {
      setMsg("❌ 保存に失敗しました：" + (e instanceof Error ? e.message : String(e)));
    } finally {
      setBusy(false);
      setBtnText("📦 PDFをまとめてZIP保存");
    }
  }

  return (
    <div>
      {BACKUP_SCRIPTS.map((src) => (
        <Script key={src} src={src} strategy="lazyOnload" />
      ))}

      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-navy md:text-2xl">顧客管理</h1>
          <p className="mt-1 text-sm text-muted-foreground">店舗別・カルテ番号順で申込書を一覧管理できます</p>
        </div>
        <button id="cBackup" type="button" className="btn btn--primary no-print" onClick={backup} disabled={busy}>
          {btnText}
        </button>
      </div>

      <div className="no-print mb-3 flex flex-wrap gap-2">
        <input id="cKeyword" className="search-input" type="text" placeholder="カルテ番号・氏名で検索" value={keyword} onChange={(e) => setKeyword(e.target.value)} />
        {!storeLocked && (
          <select id="cStore" className="search-input" value={store} onChange={(e) => setStore(e.target.value)}>
            <option value="">すべての店舗</option>
            {storeNames.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        )}
        <button
          id="cClear"
          type="button"
          className="btn btn--ghost btn--small"
          onClick={() => {
            setKeyword("");
            setStore("");
          }}
        >
          クリア
        </button>
      </div>

      <p id="cBackupMsg" className="backup-msg no-print">
        {msg}
      </p>

      {currentApps.length === 0 ? (
        <div className="empty-box">
          <p>該当する申込書はありません。</p>
        </div>
      ) : (
        groupNames.map((s) => {
          const rows = [...byStore[s]].sort((a, b) => {
            const c = chartNo(a).localeCompare(chartNo(b), "ja", { numeric: true });
            if (c !== 0) return c;
            return (a.applyDate || "").localeCompare(b.applyDate || "");
          });
          return (
            <div key={s} className="store-group">
              <h2 className="store-group__title">
                🏥 {s} <span className="store-group__count">{byStore[s].length}件</span>
              </h2>
              <div className="overflow-x-auto rounded-xl border bg-card shadow-sm">
                <table className="w-full min-w-[640px] text-sm">
                  <thead className="bg-[#eaf1fb] text-navy">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium">カルテ番号</th>
                      <th className="px-4 py-3 text-left font-medium">氏名</th>
                      <th className="px-4 py-3 text-left font-medium">フリガナ</th>
                      <th className="px-4 py-3 text-left font-medium">申込書種類</th>
                      <th className="px-4 py-3 text-left font-medium">申込日</th>
                      <th className="px-4 py-3 text-left font-medium">PDF</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((a) => (
                      <tr key={a.id} className="border-t hover:bg-muted/30">
                        <td className="px-4 py-3 font-bold">{chartNo(a) || "—"}</td>
                        <td className="px-4 py-3">{name(a)}</td>
                        <td className="px-4 py-3">{kana(a)}</td>
                        <td className="px-4 py-3">{a.templateName}</td>
                        <td className="whitespace-nowrap px-4 py-3">{formatDateJa(a.applyDate)}</td>
                        <td className="px-4 py-3">
                          <Link href={`/print/${encodeURIComponent(a.id)}`} prefetch={false} className="btn btn--small btn--primary">
                            PDF
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
