import type { Metadata } from "next";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "Ameo AI — AI-Native Operational Platform",
  description: "Ameo AI: AI-native operational system for creating, managing, and orchestrating digital products with governance-first architecture.",
  keywords: ["Ameo AI", "AI Platform", "Governance", "Runtime", "Workflow Engine", "Agent System", "TypeScript", "Next.js"],
  authors: [{ name: "Ameo AI Team" }],
  icons: {
    icon: "/favicon.svg",
  },
  openGraph: {
    title: "Ameo AI — AI-Native Operational Platform",
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
      <body className="antialiased bg-background text-foreground" style={{ fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }}>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
