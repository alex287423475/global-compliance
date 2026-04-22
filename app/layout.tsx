import type { Metadata } from "next";
import { EB_Garamond, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.qqbytop.com";

const serif = EB_Garamond({
  subsets: ["latin"],
  variable: "--font-serif",
  weight: ["500", "600"],
});

const sans = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Global Bridge Compliance | Cross-Border Compliance Solutions",
  description:
    "Global Bridge Compliance provides payment risk, market entry, crisis defense, IP response, capital-market, and B2B advisory document solutions for international clients.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "Global Bridge Compliance | Cross-Border Compliance Solutions",
    description:
      "Payment risk, market entry, crisis defense, IP response, capital-market, and B2B advisory document solutions for international clients.",
    url: "/",
    siteName: "Global Bridge Compliance",
    locale: "en_US",
    type: "website",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${serif.variable} ${sans.variable} ${mono.variable} bg-slate-50 font-sans text-blue-950 antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
