"use client";

import { useEffect, useState } from "react";
import SiteHeader from "../components/SiteHeader";

type Locale = "en" | "zh";

const content = {
  en: {
    brand: "Global Bridge Compliance",
    back: "Back to site",
    toggleZh: "中文",
    toggleEn: "EN",
    eyebrow: "Intake Center",
    title: "Dedicated evidence intake forms",
    copy:
      "Use these forms only after a diagnostic review or when instructed by the case team. Each form is designed for a specific case type so the evidence file stays structured, relevant, and reviewable.",
    noticeTitle: "Material Safety Notice",
    notice:
      "Do not upload unrelated personal data. Redact nonessential customer information where possible. For highly sensitive matters, request an NDA before submitting full evidence files. Formal submissions: intake@qqbytop.com.",
    badge: "Intake",
    openForm: "Open form",
    gated: "Available after review",
    forms: [
      {
        title: "Chargeback Evidence Intake",
        subtitle: "拒付证据调查表",
        href: "/intake/chargeback",
        status: "Open",
        copy: "Collect order details, reason codes, logistics proof, customer messages, invoices, and platform notices.",
      },
      {
        title: "PayPal / Stripe Account Review Intake",
        subtitle: "PayPal / Stripe 账户审核材料表",
        href: "#",
        status: "Diagnostic Required",
        copy: "For frozen funds, account limitations, risk reviews, and payment-policy reconstruction.",
      },
      {
        title: "Amazon POA Intake",
        subtitle: "Amazon POA 申诉材料表",
        href: "#",
        status: "Diagnostic Required",
        copy: "For suspension notices, root-cause analysis, corrective actions, and preventive measures.",
      },
      {
        title: "IP / DMCA Defense Intake",
        subtitle: "IP / DMCA 防御材料表",
        href: "#",
        status: "Diagnostic Required",
        copy: "For takedowns, IP complaints, counter-notices, evidence comparison, and marketplace appeals.",
      },
      {
        title: "Market Entry Compliance Intake",
        subtitle: "市场准入合规材料表",
        href: "#",
        status: "Diagnostic Required",
        copy: "For FDA/CE labels, Vendor Manuals, ESG declarations, CBAM/UFLPA, and supply-chain statements.",
      },
      {
        title: "Capital & B2B Advisory Intake",
        subtitle: "资本与 B2B 商务材料表",
        href: "#",
        status: "Diagnostic Required",
        copy: "For pitch decks, LOI, DD FAQ, distributor onboarding, roadshow files, and commercial proposals.",
      },
    ],
  },
  zh: {
    brand: "全球博译合规",
    back: "返回官网",
    toggleZh: "中文",
    toggleEn: "EN",
    eyebrow: "Intake Center",
    title: "专项资料收集表中心",
    copy:
      "请在完成初步诊断或收到项目团队指引后使用这些表单。每个表单对应一种案件类型，确保证据文件结构清晰、材料相关、便于审阅。",
    noticeTitle: "材料安全提示",
    notice: "请勿上传无关个人信息。可先脱敏客户资料；如涉及高度敏感材料，请先申请 NDA 后再提交完整证据文件。正式材料提交：intake@qqbytop.com。",
    badge: "资料表",
    openForm: "打开表单",
    gated: "诊断后开放",
    forms: [
      {
        title: "拒付证据调查表",
        subtitle: "Chargeback Evidence Intake",
        href: "/intake/chargeback",
        status: "已开放",
        copy: "收集订单信息、拒付原因、物流证明、客户沟通记录、发票和平台通知。",
      },
      {
        title: "PayPal / Stripe 账户审核材料表",
        subtitle: "PayPal / Stripe Account Review Intake",
        href: "#",
        status: "诊断后开放",
        copy: "用于资金冻结、账户限制、风控审核和支付政策重构案件。",
      },
      {
        title: "Amazon POA 申诉材料表",
        subtitle: "Amazon POA Intake",
        href: "#",
        status: "诊断后开放",
        copy: "用于封号通知、根因分析、整改措施和预防机制材料整理。",
      },
      {
        title: "IP / DMCA 防御材料表",
        subtitle: "IP / DMCA Defense Intake",
        href: "#",
        status: "诊断后开放",
        copy: "用于链接下架、知识产权投诉、反诉通知、证据对比和平台申诉。",
      },
      {
        title: "市场准入合规材料表",
        subtitle: "Market Entry Compliance Intake",
        href: "#",
        status: "诊断后开放",
        copy: "用于 FDA/CE 标签、Vendor Manual、ESG 声明、CBAM/UFLPA 和供应链清白材料。",
      },
      {
        title: "资本与 B2B 商务材料表",
        subtitle: "Capital & B2B Advisory Intake",
        href: "#",
        status: "诊断后开放",
        copy: "用于融资 BP、LOI、DD FAQ、经销商准入、路演材料和商务建议书。",
      },
    ],
  },
};

export default function IntakeIndexPage() {
  const [locale, setLocaleState] = useState<Locale>("en");
  const t = content[locale];

  useEffect(() => {
    const saved = window.localStorage.getItem("gbc-locale");
    const nextLocale = saved === "en" || saved === "zh"
      ? saved
      : navigator.language.toLowerCase().startsWith("zh")
        ? "zh"
        : "en";
    setLocaleState(nextLocale);
    document.documentElement.lang = nextLocale === "zh" ? "zh-CN" : "en";
  }, []);

  function setLocale(nextLocale: Locale) {
    setLocaleState(nextLocale);
    window.localStorage.setItem("gbc-locale", nextLocale);
    document.documentElement.lang = nextLocale === "zh" ? "zh-CN" : "en";
  }

  return (
    <main className="min-h-screen bg-slate-50 text-blue-950">
      <SiteHeader locale={locale} setLocale={setLocale} />

      <section className="mx-auto max-w-7xl px-6 py-20 lg:px-10">
        <div className="mb-14 max-w-3xl">
          <p className="mb-5 text-[11px] font-bold uppercase tracking-[0.2em] text-blue-800">
            {t.eyebrow}
          </p>
          <h1 className="font-[family-name:var(--font-serif)] text-5xl font-semibold leading-tight text-blue-950 md:text-6xl">
            {t.title}
          </h1>
          <p className="mt-6 text-base leading-8 text-slate-600">{t.copy}</p>
          <div className="mt-8 border-l-2 border-red-800 bg-red-50/50 py-4 pl-5">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-red-800">
              {t.noticeTitle}
            </p>
            <p className="mt-3 text-sm leading-7 text-slate-600">{t.notice}</p>
          </div>
        </div>

        <div className="grid border border-blue-900/10 bg-white lg:grid-cols-2">
          {t.forms.map((form) => {
            const isOpen = form.href !== "#";
            const card = (
              <article className="min-h-64 border-b border-blue-900/10 p-8 lg:border-r lg:[&:nth-child(2n)]:border-r-0">
                <div className="flex items-start justify-between gap-6">
                  <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-blue-800">
                    {form.status}
                  </p>
                  <span className="border border-slate-200 bg-slate-100 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-700">
                    {t.badge}
                  </span>
                </div>
                <h2 className="mt-8 text-xl font-bold leading-8 text-blue-950">{form.title}</h2>
                <p className="mt-2 text-base font-bold text-blue-950">{form.subtitle}</p>
                <p className="mt-5 text-sm leading-7 text-slate-600">{form.copy}</p>
                <p className="mt-8 text-[11px] font-bold uppercase tracking-[0.18em] text-red-800">
                  {isOpen ? t.openForm : t.gated}
                </p>
              </article>
            );

            return isOpen ? (
              <a className="block transition-colors duration-300 hover:bg-slate-50" href={form.href} key={form.title}>
                {card}
              </a>
            ) : (
              <div key={form.title}>{card}</div>
            );
          })}
        </div>
      </section>
    </main>
  );
}

function LanguageToggle({
  locale,
  setLocale,
}: {
  locale: Locale;
  setLocale: (locale: Locale) => void;
}) {
  return (
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
  );
}
