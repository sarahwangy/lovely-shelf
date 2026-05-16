import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Providers from "@/components/Providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "lovely-shelf · 把书封面变成书库",
  description: "拍一张封面，AI 自动识别书名与作者，一键存入 Notion 书库 · Scan book covers with AI and save to Notion",
};

// Next.js 13+ 推荐用 viewport export 代替 <meta name="viewport"> 手动写
// interactive-widget=resizes-content：键盘弹出时页面跟着缩，不挡住输入框
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover", // 让页面延伸到 iPhone 刘海/圆角区域，配合 safe-area-inset 使用
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
