"use client";

import { useEffect, useState } from "react";
import SiteHeader from "../../components/SiteHeader";

type Locale = "en" | "zh";

const content = {
  en: {
    brand: "Global Bridge Compliance",
    back: "Back to site",
    eyebrow: "Secure Intake Form",
    title: "Chargeback evidence intake",
    copy:
      "Use this form only after a diagnostic review or when instructed by the case team. Upload only necessary evidence. Redact unrelated personal data when possible.",
    noticeTitle: "Evidence Safety Notice",
    notice:
      "Upload only files that support the dispute response. Remove unrelated personal data where possible. For highly sensitive cases, request an NDA before sending complete records. Formal submissions: intake@qqbytran.com.",
    name: "Name",
    email: "Email",
    company: "Company / Brand",
    chargebackType: "Chargeback Type",
    paymentProvider: "Payment Provider",
    website: "Website / Store Link",
    orderId: "Order / Transaction ID",
    orderDate: "Order Date",
    amount: "Transaction Amount",
    customerEmail: "Customer Email",
    reason: "Reason Code / Dispute Reason",
    summary: "Case Summary",
    summaryPlaceholder: "What happened, what the customer claims, and the response deadline.",
    evidenceNotes: "Evidence Notes",
    evidencePlaceholder: "List uploaded files and what each one proves.",
    evidenceFiles: "Evidence Files",
    fileHint:
      "Upload screenshots, tracking proof, customer messages, invoices, or platform notices. Max 8 files, 8MB total in this prototype.",
    submit: "Submit Chargeback Intake",
    submitting: "Submitting...",
    success: "Chargeback intake received. The case team will review the evidence set and follow up with next steps.",
    error: "Submission failed. Please reduce file size and try again.",
    sourceTitle: "Source Intelligence",
    sourceCopy: "This intake was opened from an insight article. The source slug will be attached to the submission.",
    select: "Select",
    urgency: "Chargeback intake submitted",
    sensitive: "Sensitive materials may be involved",
    types: [
      "Product not received",
      "Product not as described",
      "Unauthorized transaction",
      "Duplicate charge",
      "Subscription / recurring billing dispute",
      "Other / not sure",
    ],
    providers: ["Stripe", "PayPal", "Shopify Payments", "Amazon Pay", "Other"],
  },
  zh: {
    brand: "全球博译合规",
    back: "返回官网",
    eyebrow: "Secure Intake Form",
    title: "拒付证据调查表",
    copy:
      "请仅在完成初步诊断或收到项目团队指引后填写。只上传必要证据；如有无关个人信息，请尽量先做脱敏处理。",
    noticeTitle: "证据安全提示",
    notice: "仅上传支持拒付抗辩的必要文件。可先删除无关个人信息；高度敏感案件请先申请 NDA 后再发送完整记录。正式材料提交：intake@qqbytran.com。",
    name: "称呼",
    email: "邮箱",
    company: "公司 / 品牌",
    chargebackType: "拒付类型",
    paymentProvider: "支付通道",
    website: "网站 / 店铺链接",
    orderId: "订单号 / 交易号",
    orderDate: "订单日期",
    amount: "交易金额",
    customerEmail: "客户邮箱",
    reason: "拒付原因 / Reason Code",
    summary: "案件摘要",
    summaryPlaceholder: "说明发生了什么、客户主张是什么、回复截止时间是什么。",
    evidenceNotes: "证据说明",
    evidencePlaceholder: "说明每个上传文件分别证明什么。",
    evidenceFiles: "证据附件",
    fileHint: "可上传截图、物流证明、客户沟通记录、发票或平台通知。本原型最多 8 个文件，总计 8MB。",
    submit: "提交拒付调查表",
    submitting: "提交中...",
    success: "已收到拒付证据调查表。项目团队会审查证据集，并跟进下一步。",
    error: "提交失败。请压缩文件大小后重试。",
    sourceTitle: "来源情报",
    sourceCopy: "该资料表从情报文章进入，提交时会附带来源 slug，便于后续判断案件语境。",
    select: "请选择",
    urgency: "已提交拒付调查表",
    sensitive: "可能涉及敏感材料",
    types: ["未收到商品", "商品与描述不符", "未经授权交易", "重复扣款", "订阅 / 循环扣费争议", "其他 / 不确定"],
    providers: ["Stripe", "PayPal", "Shopify Payments", "Amazon Pay", "其他"],
  },
};

export default function ChargebackIntakePage() {
  const [locale, setLocaleState] = useState<Locale>("en");
  const [sourceSlug, setSourceSlug] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
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

    const params = new URLSearchParams(window.location.search);
    setSourceSlug(params.get("source") || "");
  }, []);

  function setLocale(nextLocale: Locale) {
    setLocaleState(nextLocale);
    window.localStorage.setItem("gbc-locale", nextLocale);
    document.documentElement.lang = nextLocale === "zh" ? "zh-CN" : "en";
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("submitting");

    const form = event.currentTarget;
    const formData = new FormData(form);
    formData.set("caseType", "Payment & Capital Compliance - Chargeback Evidence Intake");
    formData.set("urgency", t.urgency);
    formData.set("sensitive", t.sensitive);

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

        <form className="grid gap-6 border border-blue-900/10 bg-white p-8" onSubmit={handleSubmit}>
          {sourceSlug ? (
            <div className="border-l-2 border-blue-950 bg-slate-50 py-4 pl-5">
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-blue-800">{t.sourceTitle}</p>
              <p className="mt-3 text-sm leading-7 text-slate-600">{t.sourceCopy}</p>
              <p className="mt-2 font-[family-name:var(--font-mono)] text-xs text-slate-500">{sourceSlug}</p>
            </div>
          ) : null}
          <input name="sourceInsightSlug" type="hidden" value={sourceSlug} />

          <div className="grid gap-5 md:grid-cols-3">
            <Field label={t.name} name="name" required />
            <Field label={t.email} name="email" required type="email" />
            <Field label={t.company} name="company" />
          </div>

          <div className="grid gap-5 md:grid-cols-3">
            <SelectField label={t.chargebackType} name="chargebackType" options={t.types} placeholder={t.select} required />
            <SelectField label={t.paymentProvider} name="paymentProvider" options={t.providers} placeholder={t.select} required />
            <Field label={t.website} name="website" type="url" />
          </div>

          <div className="grid gap-5 md:grid-cols-4">
            <Field label={t.orderId} name="orderId" required />
            <Field label={t.orderDate} name="orderDate" type="date" />
            <Field label={t.amount} name="amount" placeholder="USD 0.00" />
            <Field label={t.customerEmail} name="customerEmail" type="email" />
          </div>

          <Field label={t.reason} name="chargebackReason" />

          <TextArea label={t.summary} name="summary" placeholder={t.summaryPlaceholder} required />
          <TextArea label={t.evidenceNotes} name="evidenceNotes" placeholder={t.evidencePlaceholder} />

          <label className="grid gap-2">
            <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-blue-800">
              {t.evidenceFiles}
            </span>
            <input
              accept="image/png,image/jpeg,image/webp,application/pdf,text/plain"
              className="border-[0.5px] border-slate-300 bg-white px-4 py-3 text-sm text-blue-950 file:mr-4 file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-xs file:font-bold file:uppercase file:tracking-[0.14em] file:text-blue-950 focus:border-blue-950 focus:outline-none"
              multiple
              name="evidenceFiles"
              type="file"
            />
            <span className="text-xs leading-6 text-slate-600">{t.fileHint}</span>
          </label>

          <button
            className="border border-blue-950 bg-transparent px-8 py-3 text-sm font-bold uppercase tracking-widest text-blue-950 transition-colors duration-300 hover:bg-blue-950 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
            disabled={status === "submitting"}
            type="submit"
          >
            {status === "submitting" ? t.submitting : t.submit}
          </button>

          {status === "success" ? (
            <p className="border-l-2 border-blue-950 pl-4 text-sm leading-7 text-slate-600">{t.success}</p>
          ) : null}
          {status === "error" ? (
            <p className="border-l-2 border-red-800 pl-4 text-sm leading-7 text-red-800">{t.error}</p>
          ) : null}
        </form>
      </section>
    </main>
  );
}

function Field({
  label,
  name,
  placeholder,
  required,
  type = "text",
}: {
  label: string;
  name: string;
  placeholder?: string;
  required?: boolean;
  type?: string;
}) {
  return (
    <label className="grid gap-2">
      <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-blue-800">{label}</span>
      <input
        className="border-[0.5px] border-slate-300 bg-white px-4 py-3 text-sm text-blue-950 ring-0 focus:border-blue-950 focus:outline-none"
        name={name}
        placeholder={placeholder}
        required={required}
        type={type}
      />
    </label>
  );
}

function TextArea({
  label,
  name,
  placeholder,
  required,
}: {
  label: string;
  name: string;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <label className="grid gap-2">
      <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-blue-800">{label}</span>
      <textarea
        className="min-h-32 resize-y border-[0.5px] border-slate-300 bg-white px-4 py-3 text-sm text-blue-950 ring-0 focus:border-blue-950 focus:outline-none"
        name={name}
        placeholder={placeholder}
        required={required}
      />
    </label>
  );
}

function SelectField({
  label,
  name,
  options,
  placeholder,
  required,
}: {
  label: string;
  name: string;
  options: string[];
  placeholder: string;
  required?: boolean;
}) {
  return (
    <label className="grid gap-2">
      <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-blue-800">{label}</span>
      <select
        className="border-[0.5px] border-slate-300 bg-white px-4 py-3 text-sm text-blue-950 ring-0 focus:border-blue-950 focus:outline-none"
        name={name}
        required={required}
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option}>{option}</option>
        ))}
      </select>
    </label>
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
