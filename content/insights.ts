export type InsightArticle = {
  slug: string;
  title: string;
  zhTitle: string;
  category: string;
  market: string;
  riskLevel: "Critical" | "High" | "Medium";
  updatedAt: string;
  summary: string;
  zhSummary: string;
  redlineTerms: string[];
  sections: Array<{
    heading: string;
    zhHeading: string;
    body: string;
    zhBody: string;
  }>;
};

export const insightArticles: InsightArticle[] = [
  {
    slug: "stripe-paypal-risk-language-independent-sites",
    title: "Stripe and PayPal risk language patterns for independent websites",
    zhTitle: "独立站 Stripe 与 PayPal 风控语言模式",
    category: "Payment Risk",
    market: "North America",
    riskLevel: "Critical",
    updatedAt: "2026-04-22",
    summary:
      "A practical review of phrases that may trigger payment-gateway scrutiny, with safer alternatives for policy pages and checkout flows.",
    zhSummary:
      "梳理可能触发支付网关审查的高风险表达，并提供适用于政策页和结账流程的安全替代表达。",
    redlineTerms: ["guaranteed approval", "anonymous payment", "risk-free return"],
    sections: [
      {
        heading: "Why this matters",
        zhHeading: "为什么重要",
        body:
          "Payment gateways review not only transaction behavior but also the promises, refund language, fulfillment statements, and prohibited-category signals presented on the website.",
        zhBody:
          "支付网关审查的不只是交易行为，也包括网站上的承诺、退款表述、履约说明和违禁品类信号。",
      },
      {
        heading: "What to prepare",
        zhHeading: "需要准备什么",
        body:
          "Collect refund policy, shipping policy, product pages, checkout screenshots, prior gateway emails, and any customer-dispute history before rewriting the risk language.",
        zhBody:
          "在重写风险表达之前，需要收集退款政策、物流政策、产品页面、结账截图、历史支付网关邮件和客户争议记录。",
      },
    ],
  },
  {
    slug: "amazon-poa-root-cause-corrective-actions",
    title: "Amazon POA root-cause language and corrective-action structure",
    zhTitle: "Amazon POA 根因表达与整改措施结构",
    category: "Marketplace Appeal",
    market: "Amazon",
    riskLevel: "High",
    updatedAt: "2026-04-22",
    summary:
      "How to frame root cause, corrective action, and preventive measures without sounding defensive or generic.",
    zhSummary:
      "如何组织根因、整改措施与预防机制，避免申诉信显得防御性过强或模板化。",
    redlineTerms: ["we did nothing wrong", "system mistake", "guaranteed resolved"],
    sections: [
      {
        heading: "Root cause must be operational",
        zhHeading: "根因必须是运营层面的",
        body:
          "A strong POA identifies the exact operational failure, the control gap that allowed it, and the evidence showing the issue is now contained.",
        zhBody:
          "有力的 POA 需要指出具体运营失误、导致问题发生的控制缺口，以及问题已经被控制住的证据。",
      },
      {
        heading: "Preventive measures must be verifiable",
        zhHeading: "预防措施必须可验证",
        body:
          "Avoid vague promises. Provide process updates, staff checks, supplier controls, monitoring cadence, and documentary evidence.",
        zhBody:
          "避免空泛承诺。应提供流程更新、人员检查、供应商控制、监测频率和可证明的文件证据。",
      },
    ],
  },
  {
    slug: "cbam-uflpa-supply-chain-clean-statement",
    title: "CBAM and UFLPA supply-chain clean-statement document checklist",
    zhTitle: "CBAM 与 UFLPA 供应链清白声明文件清单",
    category: "Supply Chain",
    market: "EU / US",
    riskLevel: "High",
    updatedAt: "2026-04-22",
    summary:
      "A document checklist for exporters preparing supply-chain origin explanations, carbon-related declarations, and forced-labor risk responses.",
    zhSummary:
      "面向出口企业的供应链溯源、碳相关声明与强迫劳动风险回应文件清单。",
    redlineTerms: ["unknown origin", "unverified supplier", "no records available"],
    sections: [
      {
        heading: "Traceability starts before translation",
        zhHeading: "溯源早于文本处理",
        body:
          "A credible clean statement depends on supplier mapping, material origin records, purchase documents, logistics trails, and internal control descriptions.",
        zhBody:
          "可信的清白声明依赖供应商映射、材料来源记录、采购文件、物流轨迹和内部控制说明。",
      },
      {
        heading: "Language must match evidence",
        zhHeading: "表达必须匹配证据强度",
        body:
          "Do not overstate certainty if the evidence only supports reasonable diligence. The wording should reflect the actual documentary strength.",
        zhBody:
          "如果证据只能支持合理尽调，就不能过度表达确定性。措辞应反映实际文件证据的强度。",
      },
    ],
  },
];

export function getArticle(slug: string) {
  return insightArticles.find((article) => article.slug === slug);
}
