import type { Metadata, Viewport } from "next";
import { Anton, Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const anton = Anton({ variable: "--font-anton", weight: "400", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Shaver Team — Commission Tracker",
  description: "Deal log and commission tracking for Shaver Preferred Motors",
  robots: { index: false, follow: false },
};

// Tints the mobile browser toolbar to match the app background; default width/scale kept.
export const viewport: Viewport = { themeColor: "#0e0e11" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${inter.variable} ${anton.variable}`}>
      <body className="min-h-dvh font-sans">{children}</body>
    </html>
  );
}
