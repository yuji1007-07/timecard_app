import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "販売品在庫管理システム",
  description: "整骨院・鍼灸・エステグループ向け 販売品在庫管理システム",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
