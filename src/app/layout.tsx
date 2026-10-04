import type { Metadata } from "next";
import { Anton, Barlow_Condensed, Bebas_Neue, Geist, Geist_Mono, Oswald } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const bebas = Bebas_Neue({ variable: "--font-bebas-neue", subsets: ["latin"], weight: "400", preload: false });
const anton = Anton({ variable: "--font-anton", subsets: ["latin"], weight: "400", preload: false });
const oswald = Oswald({ variable: "--font-oswald", subsets: ["latin"], preload: false });
const barlow = Barlow_Condensed({ variable: "--font-barlow-condensed", subsets: ["latin"],
  weight: ["100", "200", "300", "400", "500", "600", "700", "800", "900"], style: "normal", preload: false });

export const metadata: Metadata = {
  title: "Content Studio | 슬라이드 편집기",
  description: "로컬 슬라이드 편집 및 관리",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ko"
      className={`${geistSans.variable} ${geistMono.variable} ${bebas.variable} ${anton.variable} ${oswald.variable} ${barlow.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
