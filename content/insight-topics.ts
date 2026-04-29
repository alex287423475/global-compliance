import { insightArticles } from "./insights";

export type InsightTopic = {
  slug: string;
  category: string;
  title: string;
  zhTitle: string;
  description: string;
  zhDescription: string;
  searchIntent: string;
  zhSearchIntent: string;
};

export const insightTopics: InsightTopic[] = [
  {
    slug: "payment-risk",
    category: "Payment Risk",
    title: "Payment Risk",
    zhTitle: "支付风控",
    description:
      "PayPal, Stripe, chargeback, refund-policy, checkout-language, and payment review evidence for independent sites and cross-border sellers.",
    zhDescription:
      "面向独立站和跨境卖家的 PayPal、Stripe、拒付、退款政策、结账页话术和支付审核证据策略。",
    searchIntent: "payment hold, gateway review, chargeback evidence, refund policy wording",
    zhSearchIntent: "资金冻结、支付网关审核、拒付证据、退款政策话术",
  },
  {
    slug: "marketplace-appeal",
    category: "Marketplace Appeal",
    title: "Marketplace Appeal",
    zhTitle: "平台申诉",
    description:
      "Amazon POA, root-cause statements, corrective-action structure, reinstatement logic, and marketplace evidence files.",
    zhDescription:
      "Amazon POA、根因陈述、整改措施结构、账号恢复逻辑和平台申诉证据文件。",
    searchIntent: "Amazon POA, account suspension appeal, root cause, corrective action",
    zhSearchIntent: "亚马逊 POA、账号封禁申诉、根因分析、整改措施",
  },
  {
    slug: "market-entry",
    category: "Market Entry",
    title: "Market Entry",
    zhTitle: "市场准入",
    description:
      "Label, policy, certification, medical, cosmetic, and regulated-category wording for overseas market entry.",
    zhDescription:
      "面向海外市场准入的标签、政策、认证、医疗、美妆和高敏品类合规表达。",
    searchIntent: "FDA claims, CE labeling, regulated category, market access wording",
    zhSearchIntent: "FDA 声称、CE 标签、监管品类、市场准入话术",
  },
  {
    slug: "supply-chain",
    category: "Supply Chain",
    title: "Supply Chain",
    zhTitle: "供应链合规",
    description:
      "CBAM, UFLPA, origin evidence, traceability, clean statements, and supplier documentation for cross-border trade.",
    zhDescription:
      "跨境贸易中的 CBAM、UFLPA、原产地证据、溯源、清白声明和供应商文件策略。",
    searchIntent: "CBAM, UFLPA, origin evidence, clean statement, supply-chain traceability",
    zhSearchIntent: "CBAM、UFLPA、原产地证据、清白声明、供应链溯源",
  },
  {
    slug: "ip-defense",
    category: "IP Defense",
    title: "IP Defense",
    zhTitle: "知识产权攻防",
    description:
      "DMCA, takedown response, infringement comparison, counter-notice structure, and platform IP defense language.",
    zhDescription:
      "DMCA、下架反击、侵权对比、反通知结构和平台知识产权攻防语言。",
    searchIntent: "DMCA counter notice, takedown response, IP complaint, infringement defense",
    zhSearchIntent: "DMCA 反通知、下架反击、知识产权投诉、侵权抗辩",
  },
  {
    slug: "crisis-pr",
    category: "Crisis PR",
    title: "Crisis PR",
    zhTitle: "危机公关",
    description:
      "Public statements, apology letters, Reddit and social escalation response, buyer trust repair, and crisis evidence alignment.",
    zhDescription:
      "海外声明、致歉信、Reddit 与社媒危机回应、买家信任修复和危机证据对齐。",
    searchIntent: "crisis statement, apology letter, Reddit backlash, brand response",
    zhSearchIntent: "危机声明、致歉信、Reddit 舆论、品牌回应",
  },
  {
    slug: "capital-documents",
    category: "Capital Documents",
    title: "Capital Documents",
    zhTitle: "资本文书",
    description:
      "Pitch decks, data-room wording, risk-factor language, LOI, due diligence answers, and high-stakes capital documents.",
    zhDescription:
      "融资 BP、数据室表述、风险因素语言、LOI、尽调答疑和高价值资本文书。",
    searchIntent: "pitch deck, data room, risk factors, LOI, due diligence FAQ",
    zhSearchIntent: "融资 BP、数据室、风险因素、LOI、尽调 FAQ",
  },
  {
    slug: "b2b-contracts",
    category: "B2B Contracts",
    title: "B2B Contracts",
    zhTitle: "B2B 合同",
    description:
      "Distribution agreements, vendor manuals, commercial proposals, quality claims, and cross-border contract risk language.",
    zhDescription:
      "经销代理协议、供应商手册、商务建议书、质量索赔和跨境合同风险语言。",
    searchIntent: "distribution agreement, vendor manual, commercial proposal, quality claim",
    zhSearchIntent: "经销代理协议、供应商手册、商务建议书、质量索赔",
  },
  {
    slug: "tax-audit",
    category: "Tax & Audit",
    title: "Tax & Audit",
    zhTitle: "税务审计",
    description:
      "Tax audit response, financial evidence, representation letters, VAT documentation, and cross-border audit language.",
    zhDescription:
      "税务调查回应、财务证据、Representation Letter、VAT 文件和跨境审计语言。",
    searchIntent: "tax audit response, representation letter, VAT evidence, financial compliance",
    zhSearchIntent: "税务调查回应、审计陈述信、VAT 证据、财务合规",
  },
  {
    slug: "data-privacy",
    category: "Data Privacy",
    title: "Data Privacy",
    zhTitle: "数据隐私",
    description:
      "GDPR, CCPA, privacy policy, cookie notice, SaaS terms, support records, and customer-data evidence requirements.",
    zhDescription:
      "GDPR、CCPA、隐私政策、Cookie 声明、SaaS 条款、客服记录和客户数据证据要求。",
    searchIntent: "GDPR privacy policy, CCPA, cookie notice, SaaS terms, customer data",
    zhSearchIntent: "GDPR 隐私政策、CCPA、Cookie 声明、SaaS 条款、客户数据",
  },
];

export function getInsightTopicBySlug(slug: string) {
  return insightTopics.find((topic) => topic.slug === slug);
}

export function getInsightTopicByCategory(category: string) {
  return insightTopics.find((topic) => topic.category === category);
}

export function getArticlesForTopic(topic: InsightTopic) {
  return insightArticles
    .filter((article) => article.category === topic.category)
    .sort((first, second) => second.updatedAt.localeCompare(first.updatedAt));
}
