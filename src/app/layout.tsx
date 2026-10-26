import type { Metadata } from "next";
import { Oswald, Inter } from "next/font/google";
import "./globals.css";

const oswald = Oswald({ variable: "--font-oswald", subsets: ["latin"], weight: "700", adjustFontFallback: false, preload: false });
const inter = Inter({ variable: "--font-inter", subsets: ["latin"], style: ["normal", "italic"], adjustFontFallback: false });

export const metadata: Metadata = {
  title: "Content Studio | 슬라이드쇼·영상 편집기",
  description: "로컬 슬라이드쇼·영상 편집 및 관리",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ko"
      className={`${oswald.variable} ${inter.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
