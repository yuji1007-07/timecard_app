import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "研修動画 | 株式会社まごころグループ",
  description: "株式会社まごころグループ 研修動画管理システム",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
