import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "まごころ在庫",
  description: "整骨院・鍼灸・エステグループ向け 販売品在庫管理システム「まごころ在庫」",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
