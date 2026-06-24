import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "週次/月次報告管理システム",
  description: "整骨院・鍼灸・エステ対応 週次/月次報告管理システム",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
