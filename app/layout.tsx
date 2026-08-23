import type { Metadata } from "next";
import { Inter, Geist_Mono } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { Analytics } from "@vercel/analytics/next";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Frontier — AI Incident Intelligence",
    template: "%s | Frontier",
  },
  description:
    "Frontier tracks and analyzes significant incidents involving unexpected, unintended, and concerning AI system behavior.",
  applicationName: "Frontier",
  keywords: [
    "AI incidents",
    "AI safety",
    "AI safety incidents",
    "artificial intelligence",
    "AI intelligence",
    "AI research",
  ],
  authors: [{ name: "Frontier" }],
  creator: "Frontier",
  publisher: "Frontier",
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    title: "Frontier — AI Incident Intelligence",
    description:
      "A living database of significant AI incidents and unexpected AI system behavior.",
    type: "website",
    siteName: "Frontier",
  },
  twitter: {
    card: "summary_large_image",
    title: "Frontier — AI Incident Intelligence",
    description:
      "Tracking significant AI incidents and unexpected AI system behavior.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={cn(
        "h-full",
        "antialiased",
        inter.variable,
        geistMono.variable,
        "font-sans"
      )}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <Analytics />
      </body>
    </html>
  );
}