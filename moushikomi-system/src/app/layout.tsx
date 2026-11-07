import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "会員入会申込書アプリ | 株式会社まごころグループ",
  description: "株式会社まごころグループ 会員入会申込書アプリ",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
