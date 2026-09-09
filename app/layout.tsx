import type { Metadata } from "next";

import { Toaster } from "@/components/ui/toast";

import "./globals.css";
export const metadata: Metadata = {
  title: "知乎脑洞 | 世界线档案库",
  description: "从知乎假设题进入另一条世界线。",
  icons: { icon: "/zhihu.svg" },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return <Toaster>{children}</Toaster>;
}
