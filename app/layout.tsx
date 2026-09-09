import type { Metadata } from "next";

import "./globals.css";
export const metadata: Metadata = {
  title: "岔路 | 世界线档案库",
  description: "从知乎假设题进入另一条世界线。",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return <>{children}</>;
}
