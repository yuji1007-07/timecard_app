"use client";

import { useRouter } from "next/navigation";

/**
 * サーバーアクションを呼ぶフォーム。実行が終わったら router.refresh() で画面を最新にする。
 *
 * サーバーアクションの中で revalidatePath を呼ぶと、この Next.js のバージョンでは
 * 応答が止まったり、結果が画面に反映されなかったりする（CLAUDE.md §4）。
 * そのためアクション側では画面更新をせず、必ずこの部品（または各フォームの
 * router.refresh()）で更新する。
 *
 * 中に <ConfirmSubmit> / <SubmitButton> を置けば、処理中の表示もそのまま効く。
 */
export function ActionForm({
  action,
  children,
  className,
}: {
  action: (formData: FormData) => Promise<unknown>;
  children: React.ReactNode;
  className?: string;
}) {
  const router = useRouter();
  return (
    <form
      className={className}
      action={async (formData) => {
        await action(formData);
        router.refresh();
      }}
    >
      {children}
    </form>
  );
}
