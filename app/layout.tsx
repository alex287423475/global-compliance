import type { Metadata } from "next";
import { EB_Garamond, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.qqbytran.com";

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
  title: "Global Bridge Compliance | PayPal, Stripe, Amazon POA & Cross-Border Risk Files",
  description:
    "Private compliance review, evidence intake, appeal files, and productized toolkits for PayPal and Stripe risk reviews, chargebacks, Amazon POA, market entry, IP defense, and cross-border B2B documents.",
  keywords: [
    "PayPal account review",
    "Stripe appeal",
    "chargeback evidence",
    "Amazon POA",
    "cross-border compliance",
    "market entry compliance",
    "IP takedown response",
    "B2B export documents",
  ],
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "Global Bridge Compliance | PayPal, Stripe, Amazon POA & Cross-Border Risk Files",
    description:
      "Private compliance review, evidence intake, appeal files, and productized toolkits for payment risk, marketplace appeals, market entry, IP defense, and cross-border B2B documents.",
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
