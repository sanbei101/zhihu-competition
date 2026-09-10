import type { Metadata } from "next";
import type { ReactNode } from "react";

import { Toaster } from "@/components/ui/toast";

import "./globals.css";
export const metadata: Metadata = {
  title: "知乎脑洞游乐园 | 脑洞副本推演",
  description: "把知乎的经典脑洞与历史假设做成副本,走进去推演属于你的世界线。",
  icons: { icon: "/zhihu.svg" },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body className="antialiased">
        <Toaster>{children}</Toaster>
      </body>
    </html>
  );
}
