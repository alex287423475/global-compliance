import type { Metadata } from "next";
import { LocalBrainDashboard } from "../../components/workflow/LocalBrainDashboard";

export const metadata: Metadata = {
  title: "Local Brain | Compliance Article Automation",
  description: "Next.js workbench for generating, validating, and publishing Local Brain compliance articles to qqbytran.com.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function LocalBrainPage() {
  return <LocalBrainDashboard />;
}
