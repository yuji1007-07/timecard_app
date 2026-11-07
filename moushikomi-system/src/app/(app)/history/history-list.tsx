"use client";

// 申込履歴一覧（旧アプリ history.js の移植）
// 作成済みの申込書を一覧表示し、検索・PDF確認・削除ができます。

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatDateJa } from "@/lib/format";
import { patientName, type ApplicationListItem } from "@/lib/types";
import { deleteApplication } from "./actions";

export function HistoryList({ apps: allApps }: { apps: ApplicationListItem[] }) {
  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [category, setCategory] = useState("");
  const [store, setStore] = useState("");

  const apps = allApps.filter((a) => {
    const pn = patientName(a).toLowerCase();
    if (name && !pn.includes(name.toLowerCase())) return false;
    if (date && a.applyDate !== date) return false;
    if (category && !(a.templateName + a.category).toLowerCase().includes(category.toLowerCase())) return false;
    if (store && !(a.storeName || "").toLowerCase().includes(store.toLowerCase())) return false;
    return true;
  });

  function clear() {
    setName("");
    setDate("");
    setCategory("");
    setStore("");
  }

  return (
    <div>
      <div className="no-print mb-4 flex flex-wrap gap-2">
        <input id="sName" className="search-input" type="text" placeholder="患者名で検索" value={name} onChange={(e) => setName(e.target.value)} />
        <input id="sDate" className="search-input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <input id="sCategory" className="search-input" type="text" placeholder="申込書種類で検索" value={category} onChange={(e) => setCategory(e.target.value)} />
        <input id="sStore" className="search-input" type="text" placeholder="店舗名で検索" value={store} onChange={(e) => setStore(e.target.value)} />
        <button id="clearSearch" type="button" className="btn btn--ghost btn--small" onClick={clear}>
          クリア
        </button>
      </div>

      {apps.length === 0 ? (
        <div className="empty-box">
          <p>該当する申込書はありません。</p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border bg-card shadow-sm">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-[#eaf1fb] text-navy">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">申込日</th>
                  <th className="px-4 py-3 text-left font-medium">患者名</th>
                  <th className="px-4 py-3 text-left font-medium">申込書種類</th>
                  <th className="px-4 py-3 text-left font-medium">店舗名</th>
                  <th className="px-4 py-3 text-left font-medium">担当者</th>
                  <th className="px-4 py-3 text-left font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {apps.map((a) => (
                  <tr key={a.id} className="border-t hover:bg-muted/30">
                    <td className="whitespace-nowrap px-4 py-3">{formatDateJa(a.applyDate)}</td>
                    <td className="px-4 py-3 font-bold">{patientName(a)}</td>
                    <td className="px-4 py-3">{a.templateName}</td>
                    <td className="px-4 py-3">{a.storeName || ""}</td>
                    <td className="px-4 py-3">{a.staffName || ""}</td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Link href={`/print/${encodeURIComponent(a.id)}`} prefetch={false} className="btn btn--small btn--primary">
                          PDF確認
                        </Link>
                        <DeleteButton id={a.id} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">{apps.length} 件</p>
        </>
      )}
    </div>
  );
}

function DeleteButton({ id }: { id: string }) {
  const [state, action, pending] = useActionState(deleteApplication, null);
  const router = useRouter();
  useEffect(() => {
    if (state?.ok) router.refresh();
    else if (state && !state.ok) alert("削除に失敗しました。" + state.message);
  }, [state, router]);
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm("この申込書を削除しますか？（元に戻せません）")) e.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={id} />
      <button type="submit" className="btn btn--small btn--danger" disabled={pending} data-del={id}>
        {pending ? "削除中…" : "削除"}
      </button>
    </form>
  );
}
