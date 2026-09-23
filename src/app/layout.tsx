import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Onest, Unbounded } from "next/font/google";
import "./globals.css";

const onest = Onest({ variable: "--font-onest", subsets: ["latin", "cyrillic"], display: "swap" });
const unbounded = Unbounded({ variable: "--font-unbounded", subsets: ["latin", "cyrillic"], weight: ["500", "700"], display: "swap" });

export const metadata: Metadata = {
  title: "АКИМ · Астана 1:1",
  description: "Интерактивный 3D-макет Астаны из OpenStreetMap: карта сверху, 3D-пролёты и события районов.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#dde3e7",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="ru" className={`${onest.variable} ${unbounded.variable}`}>
      <body>{children}</body>
    </html>
  );
}
