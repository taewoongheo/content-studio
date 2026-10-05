import type { Metadata } from "next";
import { Oswald, Geist, Inter, Space_Grotesk } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  style: ["normal", "italic"],
});

const oswald = Oswald({ variable: "--font-oswald", subsets: ["latin"], weight: "700", preload: false });
const inter = Inter({ variable: "--font-inter", subsets: ["latin"], style: ["normal", "italic"], preload: false });
const spaceGrotesk = Space_Grotesk({ variable: "--font-space-grotesk", subsets: ["latin"], preload: false });

export const metadata: Metadata = {
  title: "Content Studio | 슬라이드 편집기",
  description: "로컬 슬라이드 편집 및 관리",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ko"
      className={`${geistSans.variable} ${oswald.variable} ${inter.variable} ${spaceGrotesk.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
