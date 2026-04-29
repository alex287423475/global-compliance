import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Compliance Intelligence Library | Global Bridge Compliance",
  description:
    "Long-form cross-border compliance intelligence on PayPal and Stripe reviews, chargebacks, Amazon POA, market entry, supply-chain declarations, IP defense, crisis response, and capital documents.",
  alternates: {
    canonical: "/insights",
  },
  openGraph: {
    title: "Compliance Intelligence Library | Global Bridge Compliance",
    description:
      "Research payment risk, marketplace appeals, market entry, supply-chain declarations, IP defense, crisis response, and cross-border evidence requirements.",
    url: "/insights",
    siteName: "Global Bridge Compliance",
    locale: "en_US",
    type: "website",
  },
};

export default function InsightsLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
