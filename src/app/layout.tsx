import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { LiveProvider } from "@/components/live";
import { Shell } from "@/components/shell";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono-jb" });

export const metadata: Metadata = { title: "MarketPulse", description: "Personal financial intelligence terminal" };
export const viewport: Viewport = { themeColor: "#0a0b0d", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${inter.variable} ${mono.variable}`}>
      <body>
        <LiveProvider>
          <Shell>{children}</Shell>
        </LiveProvider>
      </body>
    </html>
  );
}
