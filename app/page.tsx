"use client";

import { useEffect, useState } from "react";

type Locale = "en" | "zh";

const content = {
  en: {
    brand: "Global Bridge Compliance",
    navAssets: "Solutions",
    navProducts: "Toolkits",
    navLibrary: "Insights",
    navIntake: "Intake",
    navProcedure: "Procedure",
    navReview: "Private Review",
    eyebrow: "Cross-Border Compliance Intelligence",
    heroTitle: "Defend payment accounts, marketplace access, and cross-border evidence before the review clock expires",
    heroCopy:
      "Global Bridge Compliance turns platform notices, policy files, dispute records, and commercial documents into controlled response packages for cross-border sellers, B2B exporters, SaaS teams, and capital-facing companies.",
    requestAssessment: "Start Private Review",
    viewAssets: "View Service Modules",
    entryEyebrow: "Start Here",
    entryTitle: "Choose the path that matches the risk clock",
    entryCopy:
      "A payment hold, an Amazon POA, a vendor file, and a digital toolkit request should not enter the same funnel. The homepage now routes each case by urgency, evidence burden, and delivery type.",
    entryRoutes: [
      {
        title: "Private Diagnostic Review",
        meta: "For urgent exposure",
        copy: "Use when funds, listings, account access, regulator replies, or strategic documents need a human risk read before submission.",
        href: "#checkout",
        action: "Request review",
      },
      {
        title: "Evidence Intake Forms",
        meta: "For material collection",
        copy: "Use structured intake forms for chargebacks, PayPal or Stripe account review, Amazon POA, IP defense, and other evidence-heavy cases.",
        href: "/intake",
        action: "Open intake",
      },
      {
        title: "Compliance Toolkits",
        meta: "For repeatable execution",
        copy: "Request reusable redline terms, safer language, evidence checklists, response frameworks, and internal SOP files.",
        href: "#products",
        action: "View toolkits",
      },
      {
        title: "Compliance Intelligence Library",
        meta: "For research and SEO traffic",
        copy: "Browse long-form compliance intelligence on payment risk, marketplace appeals, supply-chain declarations, and platform language exposure.",
        href: "/insights",
        action: "Read insights",
      },
    ],
    riskItems: [
      {
        label: "Payment & Capital",
        value: "37%",
        copy: "Gateway reviews, chargebacks, tax audits, and account-review requests that threaten cash flow.",
      },
      {
        label: "Market Entry",
        value: "112",
        copy: "Packaging, labeling, FDA/CE, vendor manuals, ESG, and supply-chain declarations.",
      },
      {
        label: "Crisis & IP",
        value: "18h",
        copy: "IP complaints, takedowns, crisis statements, quality claims, and dispute evidence windows.",
      },
    ],
    legalEyebrow: "Legal Redline",
    legalTitle:
      "Risk is not buried on the last page of a contract. It is embedded in individual words",
    detected: "High-Risk Language Detected",
    warningQuote:
      "“Guaranteed approval within 24 hours, with anonymous settlement and risk-free returns.”",
    warningCopy:
      "This language can trigger concurrent scrutiny across payment gateways, advertising review, AML posture, and consumer-protection analysis. The remedy is not synonym replacement; it is a controlled rewrite of the commercial promise, evidentiary basis, and disclaimer architecture.",
    audienceEyebrow: "Who We Serve",
    audienceTitle: "Built for teams operating under cross-border exposure",
    audiences: [
      "Cross-border sellers and marketplace operators",
      "B2B exporters and overseas distributor teams",
      "SaaS, AI, and smart-hardware companies entering regulated markets",
      "Legal, risk, compliance, and operations teams",
      "Founders preparing financing, M&A, or strategic partnerships",
    ],
    assetsEyebrow: "Solutions",
    assetsTitle: "Four cross-border crisis modules, built around the commercial risk clients actually face",
    services: [
      {
        title: "Payment & Capital Compliance",
        copy: "Protect the capital channel before algorithms, gateways, tax authorities, or chargeback systems interrupt cash flow.",
        items: [
          "PayPal / Stripe policy localization and account-review files",
          "Chargeback appeal letters and evidence packages",
          "Tax audit response statements and financial evidence files",
        ],
      },
      {
        title: "Market Entry & Supply Chain Compliance",
        copy: "Prepare the documents, labels, vendor files, and supply-chain statements needed to enter regulated overseas markets.",
        items: [
          "FDA / CE / MDR label and technical-file redline review",
          "Vendor Manual interpretation for Walmart, Target, and retail channels",
          "ESG, CBAM, UFLPA, and supply-chain clean-statement packages",
        ],
      },
      {
        title: "Crisis PR & IP Defense",
        copy: "Respond when marketplace links, brand reputation, or intellectual-property positions are under immediate attack.",
        items: [
          "DMCA counter-notices, IP complaint responses, and takedown appeals",
          "Reddit, X, and forum crisis statements with North American tone control",
          "Quality-claim rebuttal files, timelines, and liability-position statements",
        ],
      },
      {
        title: "Capital Markets & B2B Advisory",
        copy: "Shape the high-stakes business documents used in financing, acquisitions, distributor onboarding, and strategic deals.",
        items: [
          "Silicon Valley-grade pitch decks, data-room language, and roadshow files",
          "IPO risk-factor rewriting and capital-market disclosure support",
          "LOI, due-diligence FAQ, distributor onboarding, and B2B proposal files",
        ],
      },
    ],
    assetModule: "Solution Module",
    productEyebrow: "Compliance Toolkit Library",
    productTitle:
      "Productized compliance toolkits for cross-border operators, risk teams, legal teams, and capital-facing teams",
    productCopy:
      "Use standardized toolkits when you need speed, repeatability, and internal enablement across payment risk, market entry, crisis defense, and capital-market documentation.",
    products: [
      {
        title: "Payment & Capital Compliance Toolkit",
        meta: "Redlines / Evidence / Response Frames",
        copy: "PayPal and Stripe risk language, chargeback rebuttal structures, tax-audit evidence checklists, and capital-flow explanation frames.",
      },
      {
        title: "Market Entry & Supply Chain Compliance Toolkit",
        meta: "FDA / CE / ESG / Supply Chain",
        copy: "Label redlines, Vendor Manual checklists, ESG and CBAM/UFLPA declaration templates, and supplier-traceability document frameworks.",
      },
      {
        title: "Crisis PR & IP Defense Toolkit",
        meta: "DMCA / Takedown / Crisis Statement",
        copy: "DMCA counter-notice templates, marketplace takedown appeal frames, crisis-statement structures, and quality-claim rebuttal timelines.",
      },
      {
        title: "Capital Markets & B2B Advisory Toolkit",
        meta: "LOI / DD FAQ / Risk Factors",
        copy: "Pitch-deck risk language, LOI structures, due-diligence FAQ response frames, distributor-onboarding document lists, and B2B proposal patterns.",
      },
    ],
    buyPack: "Request Toolkit Access",
    customPack: "Request Custom Build",
    precisionEyebrow: "Project Knowledge File",
    precisionTitle: "Every engagement can leave behind a project knowledge file",
    precisionCopy:
      "Beyond copy adaptation or appeal drafting, each service engagement can include redline terms, safer language alternatives, evidence checklists, version notes, and platform-specific guidance for internal reuse.",
    workflowEyebrow: "Operating Procedure",
    workflowTitle: "Treat every engagement like a cross-border crisis file",
    workflow: [
      [
        "01",
        "Classify the case type",
        "Identify whether the issue sits in payment risk, market entry, crisis defense, or capital-market documentation.",
      ],
      [
        "02",
        "Review documents and exposure points",
        "Examine policies, platform notices, contracts, vendor files, evidence sets, and public-facing statements.",
      ],
      [
        "03",
        "Build the response package",
        "Produce localized policies, appeal letters, rebuttal files, compliance statements, or strategic business documents.",
      ],
      [
        "04",
        "Archive the project knowledge file",
        "Preserve redline terms, safer alternatives, evidence checklists, and version notes for internal reuse.",
      ],
    ],
    reviewEyebrow: "Private Compliance Review",
    reviewTitle: "Submit a risk sample before committing to a full redline engagement",
    reviewCopy:
      "Designed for payment holds, platform reviews, dispute escalation, regulatory responses, and high-value submissions that need calibrated language before exposure.",
    name: "Name",
    email: "Email",
    company: "Company / Brand",
    caseType: "Case Type",
    urgency: "Urgency",
    sensitive: "Sensitive Materials",
    website: "Website / Store Link",
    summary: "Case Summary",
    placeholder: "Market, platform, payment gateway, document type, current risk, and the response deadline.",
    intakeNote:
      "If the case is accepted, we will send a dedicated intake form such as a chargeback evidence form, PayPal/Stripe account-review form, Amazon POA form, or IP defense form.",
    submit: "Submit Diagnostic Request",
    submitting: "Submitting...",
    success:
      "Diagnostic request received. We will review the risk type, material completeness, and fit for a deeper engagement. You will normally receive a response within 24 hours.",
    error: "Submission failed. Please try again or contact us by email.",
    moduleOptions: [
      "Payment & Capital Compliance",
      "Market Entry & Supply Chain Compliance",
      "Crisis PR & IP Defense",
      "Capital Markets & B2B Advisory",
      "Digital Toolkit Request",
    ],
    urgencyOptions: ["Within 24 hours", "Within 3 days", "This week", "Not urgent"],
    sensitiveOptions: ["Yes, sensitive materials are involved", "No sensitive materials yet"],
    footerLeft: "Beijing Global Bridge Compliance",
    footerRight: "Cross-border trade · Dispute evidence · Compliance assets",
    phoneLabel: "Urgent cross-border matter",
    phone: "+1 (510) 403-1744",
    contactEmailLabel: "General inquiries",
    intakeEmailLabel: "Formal submissions",
    contactEmail: "contact@qqbytran.com",
    intakeEmail: "intake@qqbytran.com",
  },
  zh: {
    brand: "全球博译合规",
    navAssets: "解决方案",
    navProducts: "工具包",
    navLibrary: "情报库",
    navIntake: "资料收集",
    navProcedure: "交付程序",
    navReview: "私密评估",
    eyebrow: "Cross-Border Compliance Intelligence",
    heroTitle: "在审核倒计时前，重组支付账户、平台准入与跨境证据链",
    heroCopy:
      "全球博译合规把平台通知、政策文件、争议记录和商业文书，重组为可提交、可审阅、可追踪的跨境回应文件包，服务跨境卖家、B2B 出口企业、SaaS 团队和资本运作项目。",
    requestAssessment: "启动私密评估",
    viewAssets: "查看服务模块",
    entryEyebrow: "Start Here",
    entryTitle: "按风险倒计时选择入口",
    entryCopy:
      "支付冻结、Amazon POA、供应商文件和数字工具包请求，不应该进入同一个表单。首页按紧急程度、证据负担和交付类型分流。",
    entryRoutes: [
      {
        title: "私密合规诊断",
        meta: "适合紧急暴露风险",
        copy: "资金、链接、账户权限、监管回复或战略文书需要提交前风险判断时，从这里开始。",
        href: "#checkout",
        action: "预约评估",
      },
      {
        title: "证据资料收集表",
        meta: "适合材料整理",
        copy: "拒付、PayPal/Stripe 账户审核、Amazon POA、IP 防御等证据密集型案件，使用专项表单收集材料。",
        href: "/intake",
        action: "打开资料表",
      },
      {
        title: "合规工具包",
        meta: "适合复用执行",
        copy: "申请可复用的红线词、安全表达、证据清单、回应框架和内部 SOP 文件。",
        href: "#products",
        action: "查看工具包",
      },
      {
        title: "合规情报库",
        meta: "适合研究与自然流量",
        copy: "阅读支付风控、平台申诉、供应链声明和平台语言风险相关的深度合规情报文章。",
        href: "/insights",
        action: "阅读情报",
      },
    ],
    riskItems: [
      {
        label: "支付与资本",
        value: "37%",
        copy: "支付网关审查、拒付、税务调查和账户审核请求会直接威胁现金流。",
      },
      {
        label: "市场准入",
        value: "112",
        copy: "包装、标签、FDA/CE、供应商手册、ESG 和供应链清白声明构成入场门槛。",
      },
      {
        label: "危机与 IP",
        value: "18h",
        copy: "IP 投诉、链接下架、舆论危机、质量索赔和争议证据窗口都需要快速处理。",
      },
    ],
    legalEyebrow: "Legal Redline",
    legalTitle: "风险不是写在合同最后一页，而是藏在每一个词里",
    detected: "High-Risk Language Detected",
    warningQuote:
      "“Guaranteed approval within 24 hours, with anonymous settlement and risk-free returns.”",
    warningCopy:
      "上述表达可能同时触发支付网关、广告合规、反洗钱和消费者保护语境中的多重审查。处理方式不是替换几个单词，而是重写商业承诺、证据依据和免责声明结构。",
    audienceEyebrow: "Who We Serve",
    audienceTitle: "为处在跨境暴露风险中的团队而建",
    audiences: [
      "跨境卖家与平台运营团队",
      "B2B 出口企业与海外经销商团队",
      "进入监管市场的 SaaS、AI 与智能硬件公司",
      "法务、风控、合规与运营团队",
      "正在融资、并购或推进战略合作的创始团队",
    ],
    assetsEyebrow: "Solutions",
    assetsTitle: "围绕客户真实商业风险划分的四大跨境危机解决模块",
    services: [
      {
        title: "跨国资金通道与支付风控护盾",
        copy: "在算法、支付网关、税务机关或拒付系统切断现金流之前，先保护企业资金通道。",
        items: [
          "PayPal / Stripe 政策本地化与账户审核材料",
          "高危拒付申诉信与证据包",
          "税务调查回复陈述与财务证据文件",
        ],
      },
      {
        title: "全球市场准入与供应链合规",
        copy: "准备进入海外监管市场所需的文件、标签、供应商资料和供应链清白声明。",
        items: [
          "FDA / CE / MDR 标签与技术文件红线预审",
          "Walmart、Target 等 Vendor Manual 深度解读",
          "ESG、CBAM、UFLPA 与供应链清白声明包",
        ],
      },
      {
        title: "跨国危机公关与知识产权攻防",
        copy: "当平台链接、品牌声誉或知识产权阵地遭遇攻击时，快速建立反击文件。",
        items: [
          "DMCA 反诉、IP 投诉回复与平台下架申诉",
          "Reddit、X、论坛危机声明与北美语气控制",
          "重大质量索赔抗辩、时间线与责任豁免陈述",
        ],
      },
      {
        title: "跨国资本运作与高端商务决策",
        copy: "重塑融资、并购、经销商准入和战略合作中的高风险商业文书。",
        items: [
          "硅谷级融资 BP、Data Room 语言和 Roadshow 材料",
          "IPO 风险因素重写与资本市场披露支持",
          "LOI、DD FAQ、经销商准入和 B2B 商务建议书",
        ],
      },
    ],
    assetModule: "Solution Module",
    productEyebrow: "Compliance Toolkit Library",
    productTitle: "面向跨境经营、风控、法务和资本团队的产品化合规工具包",
    productCopy:
      "标准工具包适合在支付风控、市场准入、危机攻防和资本文书场景中快速复用、团队培训和内部 SOP 建设。",
    products: [
      {
        title: "支付与资本合规工具包",
        meta: "红线词 / 证据清单 / 回应框架",
        copy: "包含 PayPal/Stripe 风控语言、Chargeback 抗辩结构、Tax Audit 证据清单和资金流说明框架。",
      },
      {
        title: "市场准入与供应链合规工具包",
        meta: "FDA / CE / ESG / 供应链",
        copy: "包含标签红线、Vendor Manual 检查清单、ESG/CBAM/UFLPA 声明模板和供应链溯源文件框架。",
      },
      {
        title: "危机公关与 IP 防御工具包",
        meta: "DMCA / 下架申诉 / 危机声明",
        copy: "包含 DMCA 反诉模板、平台下架申诉框架、危机公关声明结构和质量索赔抗辩时间线。",
      },
      {
        title: "资本市场与 B2B 商务工具包",
        meta: "LOI / DD FAQ / 风险披露",
        copy: "包含 Pitch Deck 风险披露句式、LOI 结构、尽调 FAQ 答复框架、经销商准入文书清单和 B2B 建议书模式。",
      },
    ],
    buyPack: "申请工具包访问",
    customPack: "申请定制构建",
    precisionEyebrow: "Project Knowledge File",
    precisionTitle: "每个项目交付后，形成一份项目知识档案",
    precisionCopy:
      "除了本地化文本或申诉信，每个服务项目还可以附带红线词、安全表达、证据清单、版本记录和平台适配说明，作为客户后续复用的内部资料。",
    workflowEyebrow: "Operating Procedure",
    workflowTitle: "像处理跨境危机文件一样处理每一个项目",
    workflow: [
      [
        "01",
        "确认问题类型",
        "判断问题属于支付风控、市场准入、危机攻防，还是资本与 B2B 商务文书。",
      ],
      [
        "02",
        "审查文件与暴露点",
        "检查政策文本、平台通知、合同、供应商文件、证据材料和公开声明。",
      ],
      [
        "03",
        "构建回应文件包",
        "输出本地化政策文本、申诉信、抗辩文件、合规声明或战略级商务文书。",
      ],
      [
        "04",
        "整理项目知识档案",
        "归档本项目中的红线词、安全表达、证据清单和版本记录，供客户内部复用。",
      ],
    ],
    reviewEyebrow: "Private Compliance Review",
    reviewTitle: "先提交一份风险样张，再决定是否进入深度排雷",
    reviewCopy:
      "适用于支付冻结、平台审查、跨境争议、监管回复和高价值材料提交前的语言风险校准。",
    name: "称呼",
    email: "邮箱",
    company: "公司 / 品牌",
    caseType: "项目类型",
    urgency: "紧急程度",
    sensitive: "是否涉及敏感材料",
    website: "网站 / 店铺链接",
    summary: "问题摘要",
    placeholder: "市场、平台、支付网关、材料类型、当前风险、回复截止时间。",
    intakeNote:
      "如果案件进入受理阶段，我们会发送对应的专项资料收集表，例如拒付证据调查表、PayPal/Stripe 解封材料表、Amazon POA 材料表或 IP 防御材料表。",
    submit: "提交诊断申请",
    submitting: "提交中...",
    success:
      "已收到诊断申请。我们将先判断风险类型、材料完整度与是否适合进入深度服务，通常会在 24 小时内回复。",
    error: "提交失败。请重试，或通过邮箱联系我们。",
    moduleOptions: [
      "跨国资金通道与支付风控",
      "全球市场准入与供应链合规",
      "跨国危机公关与知识产权攻防",
      "跨国资本运作与高端商务决策",
      "数字工具包 / 工具包咨询",
    ],
    urgencyOptions: ["24 小时内", "3 天内", "本周内", "不紧急"],
    sensitiveOptions: ["是，涉及敏感材料", "暂不涉及敏感材料"],
    footerLeft: "北京全球博译合规",
    footerRight: "跨境贸易 · 争议证据 · 合规资产",
    phoneLabel: "紧急跨境案件",
    phone: "+1 (510) 403-1744",
    contactEmailLabel: "普通咨询",
    intakeEmailLabel: "正式材料提交",
    contactEmail: "contact@qqbytran.com",
    intakeEmail: "intake@qqbytran.com",
  },
} satisfies Record<Locale, Record<string, unknown>>;

const forbiddenTerms = [
  "guaranteed approval",
  "risk-free return",
  "FDA certified cure",
  "instant customs clearance",
  "anonymous payment",
];

export default function Home() {
  const [locale, setLocaleState] = useState<Locale>("en");
  const t = content[locale];

  useEffect(() => {
    const saved = window.localStorage.getItem("gbc-locale");
    if (saved === "en" || saved === "zh") {
      setLocaleState(saved);
      document.documentElement.lang = saved === "zh" ? "zh-CN" : "en";
      return;
    }

    const browserLocale = navigator.language.toLowerCase().startsWith("zh") ? "zh" : "en";
    setLocaleState(browserLocale);
    document.documentElement.lang = browserLocale === "zh" ? "zh-CN" : "en";
  }, []);

  function setLocale(nextLocale: Locale) {
    setLocaleState(nextLocale);
    window.localStorage.setItem("gbc-locale", nextLocale);
    document.documentElement.lang = nextLocale === "zh" ? "zh-CN" : "en";
  }

  return (
    <main className="min-h-screen bg-slate-50 text-blue-950">
      <Header locale={locale} setLocale={setLocale} t={t} />
      <Hero t={t} />
      <EntryRoutes t={t} />
      <RiskPanel t={t} />
      <AudienceBand t={t} />
      <AuthorityGrid t={t} />
      <ProductStore t={t} />
      <AssetPreview t={t} />
      <Workflow t={t} />
      <CheckoutBlock t={t} />
      <Footer t={t} />
    </main>
  );
}

function Header({
  locale,
  setLocale,
  t,
}: {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: typeof content.en;
}) {
  return (
    <header className="sticky top-0 z-50 border-b-[0.5px] border-slate-200 bg-slate-50/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6 lg:px-10">
        <a className="font-[family-name:var(--font-serif)] text-xl font-semibold text-blue-950" href="#">
          {String(t.brand)}
        </a>
        <div className="flex items-center gap-6">
          <nav className="hidden items-center gap-8 text-[12px] font-bold uppercase tracking-[0.18em] text-slate-600 md:flex">
            <a className="transition-colors duration-300 hover:text-blue-950" href="#services">
              {String(t.navAssets)}
            </a>
            <a className="transition-colors duration-300 hover:text-blue-950" href="#products">
              {String(t.navProducts)}
            </a>
            <a className="transition-colors duration-300 hover:text-blue-950" href="/insights">
              {String(t.navLibrary)}
            </a>
            <a className="transition-colors duration-300 hover:text-blue-950" href="/intake">
              {String(t.navIntake)}
            </a>
            <a className="transition-colors duration-300 hover:text-blue-950" href="#workflow">
              {String(t.navProcedure)}
            </a>
            <a className="transition-colors duration-300 hover:text-blue-950" href="#checkout">
              {String(t.navReview)}
            </a>
          </nav>
          <div className="flex border border-blue-900/10 text-[11px] font-bold uppercase tracking-[0.18em]">
            <button
              className={`px-3 py-2 transition-colors duration-300 ${
                locale === "en" ? "bg-blue-950 text-white" : "bg-transparent text-blue-950 hover:bg-slate-100"
              }`}
              onClick={() => setLocale("en")}
              type="button"
            >
              EN
            </button>
            <button
              className={`border-l border-blue-900/10 px-3 py-2 transition-colors duration-300 ${
                locale === "zh" ? "bg-blue-950 text-white" : "bg-transparent text-blue-950 hover:bg-slate-100"
              }`}
              onClick={() => setLocale("zh")}
              type="button"
            >
              中文
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}

function Hero({ t }: { t: typeof content.en }) {
  const riskItems = t.riskItems as Array<{ label: string; value: string; copy: string }>;

  return (
    <section className="mx-auto max-w-7xl px-6 pb-20 pt-24 lg:px-10 lg:pb-28 lg:pt-32">
      <div className="max-w-3xl">
        <p className="mb-6 text-[11px] font-bold uppercase tracking-[0.2em] text-blue-800">
          {String(t.eyebrow)}
        </p>
        <h1 className="font-[family-name:var(--font-serif)] text-5xl font-semibold leading-[1.04] text-blue-950 md:text-7xl">
          {String(t.heroTitle)}
        </h1>
        <p className="mt-8 max-w-2xl text-base leading-8 text-slate-600 md:text-lg">
          {String(t.heroCopy)}
        </p>
        <div className="mt-10 flex flex-col gap-3 sm:flex-row">
          <a
            className="inline-flex items-center justify-center border border-blue-950 bg-transparent px-8 py-3 text-sm font-bold uppercase tracking-widest text-blue-950 transition-colors duration-300 hover:bg-blue-950 hover:text-white"
            href="#checkout"
          >
            {String(t.requestAssessment)}
          </a>
          <a
            className="inline-flex items-center justify-center border border-slate-300 bg-white px-8 py-3 text-sm font-bold uppercase tracking-widest text-slate-700 transition-colors duration-300 hover:border-blue-950 hover:text-blue-950"
            href="#services"
          >
            {String(t.viewAssets)}
          </a>
        </div>
      </div>

      <div className="mt-24 grid border-y border-blue-900/10 md:grid-cols-3">
        {riskItems.map((item) => (
          <div className="border-blue-900/10 py-8 md:border-r md:px-8 md:last:border-r-0" key={item.label}>
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-blue-800">{item.label}</p>
            <p className="mt-4 font-[family-name:var(--font-serif)] text-5xl font-semibold text-blue-950">
              {item.value}
            </p>
            <p className="mt-4 max-w-xs text-sm leading-6 text-slate-600">{item.copy}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function EntryRoutes({ t }: { t: typeof content.en }) {
  const routes = t.entryRoutes as Array<{ title: string; meta: string; copy: string; href: string; action: string }>;

  return (
    <section className="mx-auto mb-24 max-w-7xl px-6 lg:px-10">
      <div className="grid gap-10 border-y border-blue-900/10 py-14 lg:grid-cols-[0.58fr_1fr]">
        <div className="max-w-xl">
          <p className="mb-5 text-[11px] font-bold uppercase tracking-[0.2em] text-blue-800">
            {String(t.entryEyebrow)}
          </p>
          <h2 className="font-[family-name:var(--font-serif)] text-4xl font-medium leading-tight text-blue-950 md:text-5xl">
            {String(t.entryTitle)}
          </h2>
          <p className="mt-6 text-sm leading-7 text-slate-600">
            {String(t.entryCopy)}
          </p>
        </div>

        <div className="grid border border-blue-900/10 bg-white md:grid-cols-2">
          {routes.map((route) => (
            <a
              className="group min-h-60 border-b border-blue-900/10 p-7 transition-colors duration-300 hover:bg-slate-50 md:border-r md:[&:nth-child(2n)]:border-r-0"
              href={route.href}
              key={route.title}
            >
              <p className="font-[family-name:var(--font-mono)] text-xs font-bold uppercase tracking-[0.16em] text-red-800">
                {route.meta}
              </p>
              <h3 className="mt-7 text-xl font-bold leading-7 text-blue-950">{route.title}</h3>
              <p className="mt-4 text-sm leading-7 text-slate-600">{route.copy}</p>
              <p className="mt-6 text-[11px] font-bold uppercase tracking-[0.18em] text-blue-800 transition-colors duration-300 group-hover:text-blue-950">
                {route.action}
              </p>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}

function RiskPanel({ t }: { t: typeof content.en }) {
  return (
    <section className="mx-auto mb-24 max-w-7xl px-6 lg:px-10">
      <div className="grid gap-12 border-t border-blue-900/10 pt-16 lg:grid-cols-[0.72fr_1fr]">
        <div>
          <p className="mb-5 text-[11px] font-bold uppercase tracking-[0.2em] text-blue-800">
            {String(t.legalEyebrow)}
          </p>
          <h2 className="font-[family-name:var(--font-serif)] text-4xl font-medium leading-tight text-blue-950 md:text-5xl">
            {String(t.legalTitle)}
          </h2>
        </div>

        <div className="border-l-2 border-red-800 bg-red-50/50 py-6 pl-6">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-red-800">
            {String(t.detected)}
          </p>
          <blockquote className="mt-5 font-[family-name:var(--font-serif)] text-2xl font-medium leading-9 text-red-800">
            {String(t.warningQuote)}
          </blockquote>
          <p className="mt-6 max-w-3xl text-sm leading-7 text-slate-600">
            {String(t.warningCopy)}
          </p>
        </div>
      </div>
    </section>
  );
}

function AudienceBand({ t }: { t: typeof content.en }) {
  const audiences = t.audiences as string[];

  return (
    <section className="mx-auto mb-24 max-w-7xl px-6 lg:px-10">
      <div className="grid gap-10 border-y border-blue-900/10 py-12 lg:grid-cols-[0.62fr_1fr]">
        <div>
          <p className="mb-5 text-[11px] font-bold uppercase tracking-[0.2em] text-blue-800">
            {String(t.audienceEyebrow)}
          </p>
          <h2 className="font-[family-name:var(--font-serif)] text-4xl font-medium leading-tight text-blue-950 md:text-5xl">
            {String(t.audienceTitle)}
          </h2>
        </div>
        <div className="grid gap-1 border border-blue-900/10 bg-white">
          {audiences.map((audience) => (
            <div className="grid grid-cols-[12px_1fr] gap-4 border-b border-blue-900/10 px-6 py-5 last:border-b-0" key={audience}>
              <span className="mt-2 h-1.5 w-1.5 bg-red-800" aria-hidden="true" />
              <p className="text-sm font-bold leading-7 text-blue-950">{audience}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function AuthorityGrid({ t }: { t: typeof content.en }) {
  const services = t.services as Array<{ title: string; copy: string; items: string[] }>;

  return (
    <section className="mx-auto mb-24 scroll-mt-24 max-w-7xl px-6 lg:px-10" id="services">
      <div className="mb-12 max-w-3xl">
        <p className="mb-5 text-[11px] font-bold uppercase tracking-[0.2em] text-blue-800">
          {String(t.assetsEyebrow)}
        </p>
        <h2 className="font-[family-name:var(--font-serif)] text-4xl font-medium leading-tight text-blue-950 md:text-5xl">
          {String(t.assetsTitle)}
        </h2>
      </div>

      <div className="grid border border-blue-900/10 bg-white lg:grid-cols-2">
        {services.map((service) => (
          <div className="min-h-80 border-b border-blue-900/10 p-8 lg:border-r lg:[&:nth-child(2n)]:border-r-0" key={service.title}>
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-blue-800">
              {String(t.assetModule)}
            </p>
            <h3 className="mt-8 text-lg font-bold leading-7 text-blue-950">{service.title}</h3>
            <p className="mt-4 text-sm leading-7 text-slate-600">{service.copy}</p>
            <ul className="mt-6 space-y-3 border-t border-blue-900/10 pt-5">
              {service.items.map((item) => (
                <li className="grid grid-cols-[10px_1fr] gap-3 text-sm leading-6 text-slate-600" key={item}>
                  <span className="mt-2 h-1.5 w-1.5 bg-red-800" aria-hidden="true" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

function ProductStore({ t }: { t: typeof content.en }) {
  const products = t.products as Array<{ title: string; meta: string; copy: string }>;

  return (
    <section className="mx-auto mb-24 scroll-mt-24 max-w-7xl px-6 lg:px-10" id="products">
      <div className="grid gap-10 border-y border-blue-900/10 py-16 lg:grid-cols-[0.72fr_1fr]">
        <div className="max-w-3xl">
          <p className="mb-5 text-[11px] font-bold uppercase tracking-[0.2em] text-blue-800">
            {String(t.productEyebrow)}
          </p>
          <h2 className="font-[family-name:var(--font-serif)] text-4xl font-medium leading-tight text-blue-950 md:text-5xl">
            {String(t.productTitle)}
          </h2>
          <p className="mt-6 text-base leading-8 text-slate-600">
            {String(t.productCopy)}
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <a
              className="inline-flex items-center justify-center border border-blue-950 bg-transparent px-8 py-3 text-sm font-bold uppercase tracking-widest text-blue-950 transition-colors duration-300 hover:bg-blue-950 hover:text-white"
              href="#checkout"
            >
              {String(t.buyPack)}
            </a>
            <a
              className="inline-flex items-center justify-center border border-slate-300 bg-white px-8 py-3 text-sm font-bold uppercase tracking-widest text-slate-700 transition-colors duration-300 hover:border-blue-950 hover:text-blue-950"
              href="#checkout"
            >
              {String(t.customPack)}
            </a>
          </div>
        </div>

        <div className="grid border border-blue-900/10 bg-white md:grid-cols-2">
          {products.map((product) => (
            <article className="min-h-64 border-b border-blue-900/10 p-7 md:border-r md:[&:nth-child(2n)]:border-r-0" key={product.title}>
              <p className="font-[family-name:var(--font-mono)] text-xs font-bold uppercase tracking-[0.16em] text-red-800">
                {product.meta}
              </p>
              <h3 className="mt-8 text-lg font-bold leading-7 text-blue-950">{product.title}</h3>
              <p className="mt-4 text-sm leading-7 text-slate-600">{product.copy}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function AssetPreview({ t }: { t: typeof content.en }) {
  return (
    <section className="mx-auto mb-24 grid max-w-7xl gap-12 px-6 lg:grid-cols-[0.8fr_1fr] lg:px-10" id="assets">
      <div className="max-w-3xl">
        <p className="mb-5 text-[11px] font-bold uppercase tracking-[0.2em] text-blue-800">
          {String(t.precisionEyebrow)}
        </p>
        <h2 className="font-[family-name:var(--font-serif)] text-4xl font-medium leading-tight text-blue-950 md:text-5xl">
          {String(t.precisionTitle)}
        </h2>
        <p className="mt-6 text-base leading-8 text-slate-600">
          {String(t.precisionCopy)}
        </p>
      </div>

      <div className="border border-blue-900/10 bg-white">
        <div className="border-b border-blue-900/10 px-6 py-4 text-[11px] font-bold uppercase tracking-[0.2em] text-blue-800">
          Project File Snapshot
        </div>
        <pre className="overflow-x-auto p-6 font-[family-name:var(--font-mono)] text-[13px] leading-7 text-slate-700">
{`{
  "project_file_id": "gbc-case-050",
  "market": "north_america",
  "risk_level": "critical",
  "redline_terms": [
    "guaranteed approval",
    "anonymous payment"
  ],
  "review_required": true
}`}
        </pre>
      </div>

      <div className="lg:col-span-2">
        <div className="grid gap-3 md:grid-cols-5">
          {forbiddenTerms.map((term) => (
            <span
              className="border border-slate-200 bg-slate-100 px-4 py-3 font-[family-name:var(--font-mono)] text-xs text-slate-700"
              key={term}
            >
              {term}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

function Workflow({ t }: { t: typeof content.en }) {
  const workflow = t.workflow as string[][];

  return (
    <section className="mx-auto mb-24 max-w-7xl px-6 lg:px-10" id="workflow">
      <div className="mb-12 max-w-3xl">
        <p className="mb-5 text-[11px] font-bold uppercase tracking-[0.2em] text-blue-800">
          {String(t.workflowEyebrow)}
        </p>
        <h2 className="font-[family-name:var(--font-serif)] text-4xl font-medium leading-tight text-blue-950 md:text-5xl">
          {String(t.workflowTitle)}
        </h2>
      </div>

      <div className="border-y border-blue-900/10">
        {workflow.map(([step, title, copy]) => (
          <div className="grid gap-6 border-b border-blue-900/10 py-8 last:border-b-0 md:grid-cols-[120px_0.7fr_1fr]" key={step}>
            <p className="font-[family-name:var(--font-mono)] text-sm font-bold text-red-800">{step}</p>
            <h3 className="text-xl font-bold text-blue-950">{title}</h3>
            <p className="max-w-3xl text-sm leading-7 text-slate-600">{copy}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function CheckoutBlock({ t }: { t: typeof content.en }) {
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const moduleOptions = t.moduleOptions as string[];
  const urgencyOptions = t.urgencyOptions as string[];
  const sensitiveOptions = t.sensitiveOptions as string[];

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("submitting");

    const form = event.currentTarget;
    const formData = new FormData(form);

    try {
      const response = await fetch("/api/diagnostic-review", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Request failed");
      }

      form.reset();
      setStatus("success");
    } catch {
      setStatus("error");
    }
  }

  return (
    <section className="bg-blue-950 px-6 py-24 text-white lg:px-10" id="checkout">
      <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[0.9fr_1fr]">
        <div className="max-w-3xl">
          <p className="mb-5 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-300">
            {String(t.reviewEyebrow)}
          </p>
          <h2 className="font-[family-name:var(--font-serif)] text-4xl font-medium leading-tight md:text-5xl">
            {String(t.reviewTitle)}
          </h2>
          <p className="mt-6 text-base leading-8 text-slate-300">
            {String(t.reviewCopy)}
          </p>
          <div className="mt-8 border-l-2 border-white/50 pl-5">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-300">
              {String(t.phoneLabel)}
            </p>
            <a className="mt-3 block text-lg font-bold text-white" href="tel:+15104031744">
              {String(t.phone)}
            </a>
            <div className="mt-5 grid gap-2 text-sm leading-7 text-slate-300">
              <p>
                {String(t.contactEmailLabel)}:{" "}
                <a className="text-white hover:text-slate-300" href={`mailto:${String(t.contactEmail)}`}>
                  {String(t.contactEmail)}
                </a>
              </p>
              <p>
                {String(t.intakeEmailLabel)}:{" "}
                <a className="text-white hover:text-slate-300" href={`mailto:${String(t.intakeEmail)}`}>
                  {String(t.intakeEmail)}
                </a>
              </p>
            </div>
          </div>
        </div>

        <form className="border border-white/20 bg-blue-950 p-8" onSubmit={handleSubmit}>
          <div className="grid gap-5">
            <div className="grid gap-5 md:grid-cols-2">
              <label className="grid gap-2">
                <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-300">
                  {String(t.name)}
                </span>
                <input
                  className="border-[0.5px] border-slate-300 bg-white px-4 py-3 text-sm text-blue-950 ring-0 focus:border-blue-950 focus:outline-none"
                  name="name"
                  required
                  type="text"
                />
              </label>
              <label className="grid gap-2">
                <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-300">
                  {String(t.email)}
                </span>
                <input
                  className="border-[0.5px] border-slate-300 bg-white px-4 py-3 text-sm text-blue-950 ring-0 focus:border-blue-950 focus:outline-none"
                  name="email"
                  placeholder="founder@example.com"
                  required
                  type="email"
                />
              </label>
            </div>
            <label className="grid gap-2">
              <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-300">
                {String(t.company)}
              </span>
              <input
                className="border-[0.5px] border-slate-300 bg-white px-4 py-3 text-sm text-blue-950 ring-0 focus:border-blue-950 focus:outline-none"
                name="company"
                type="text"
              />
            </label>
            <div className="grid gap-5 md:grid-cols-2">
              <label className="grid gap-2">
                <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-300">
                  {String(t.caseType)}
                </span>
                <select
                  className="border-[0.5px] border-slate-300 bg-white px-4 py-3 text-sm text-blue-950 ring-0 focus:border-blue-950 focus:outline-none"
                  name="caseType"
                  required
                >
                  {moduleOptions.map((option) => (
                    <option key={option}>{option}</option>
                  ))}
                </select>
              </label>
              <label className="grid gap-2">
                <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-300">
                  {String(t.urgency)}
                </span>
                <select
                  className="border-[0.5px] border-slate-300 bg-white px-4 py-3 text-sm text-blue-950 ring-0 focus:border-blue-950 focus:outline-none"
                  name="urgency"
                  required
                >
                  {urgencyOptions.map((option) => (
                    <option key={option}>{option}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="grid gap-5 md:grid-cols-2">
              <label className="grid gap-2">
                <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-300">
                  {String(t.sensitive)}
                </span>
                <select
                  className="border-[0.5px] border-slate-300 bg-white px-4 py-3 text-sm text-blue-950 ring-0 focus:border-blue-950 focus:outline-none"
                  name="sensitive"
                  required
                >
                  {sensitiveOptions.map((option) => (
                    <option key={option}>{option}</option>
                  ))}
                </select>
              </label>
              <label className="grid gap-2">
                <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-300">
                  {String(t.website)}
                </span>
                <input
                  className="border-[0.5px] border-slate-300 bg-white px-4 py-3 text-sm text-blue-950 ring-0 focus:border-blue-950 focus:outline-none"
                  name="website"
                  placeholder="https://"
                  type="url"
                />
              </label>
            </div>
            <label className="grid gap-2">
              <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-300">
                {String(t.summary)}
              </span>
              <textarea
                className="min-h-36 resize-y border-[0.5px] border-slate-300 bg-white px-4 py-3 text-sm text-blue-950 ring-0 focus:border-blue-950 focus:outline-none"
                name="summary"
                placeholder={String(t.placeholder)}
                required
              />
            </label>
            <p className="border-l-2 border-white/50 pl-4 text-sm leading-7 text-slate-300">
              {String(t.intakeNote)}
            </p>
            <button
              className="border border-white bg-transparent px-8 py-3 text-sm font-bold uppercase tracking-widest text-white transition-colors duration-300 hover:bg-white hover:text-blue-950 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={status === "submitting"}
              type="submit"
            >
              {status === "submitting" ? String(t.submitting) : String(t.submit)}
            </button>
            {status === "success" ? (
              <p className="border-l-2 border-white/70 pl-4 text-sm leading-7 text-slate-200">
                {String(t.success)}
              </p>
            ) : null}
            {status === "error" ? (
              <p className="border-l-2 border-red-400 pl-4 text-sm leading-7 text-red-100">
                {String(t.error)}
              </p>
            ) : null}
          </div>
        </form>
      </div>
    </section>
  );
}

function Footer({ t }: { t: typeof content.en }) {
  return (
    <footer className="bg-blue-950 px-6 pb-10 text-slate-300 lg:px-10">
      <div className="mx-auto grid max-w-7xl gap-4 border-t border-white/20 pt-8 text-xs uppercase tracking-[0.18em] lg:grid-cols-4">
        <p>{String(t.footerLeft)}</p>
        <p>{String(t.footerRight)}</p>
        <p>
          {String(t.contactEmailLabel)}:{" "}
          <a className="text-white transition-colors duration-300 hover:text-slate-300" href={`mailto:${String(t.contactEmail)}`}>
            {String(t.contactEmail)}
          </a>
        </p>
        <p className="lg:text-right">
          {String(t.phoneLabel)}:{" "}
          <a className="text-white transition-colors duration-300 hover:text-slate-300" href="tel:+15104031744">
            {String(t.phone)}
          </a>
        </p>
      </div>
    </footer>
  );
}
