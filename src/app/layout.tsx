import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Ameo AI — Governed AI-Native Operational Platform",
  description: "Ameo AI: AI-native operational system for creating, managing, and orchestrating digital products with governance-first architecture.",
  keywords: ["Ameo AI", "AI Platform", "Governance", "Runtime", "Workflow Engine", "Agent System", "TypeScript", "Next.js"],
  authors: [{ name: "Ameo AI Team" }],
  icons: {
    icon: "https://z-cdn.chatglm.cn/z-ai/static/logo.svg",
  },
  openGraph: {
    title: "Ameo AI — Governed AI Platform",
    description: "AI-native operational system with governance-first architecture",
    siteName: "Ameo AI",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Ameo AI",
    description: "AI-native operational system with governance-first architecture",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
