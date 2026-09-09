import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "vinext template",
  description: "vinext template with tailwindcss and shadcn ui",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return <>{children}</>;
}
