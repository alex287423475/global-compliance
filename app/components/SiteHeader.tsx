"use client";

type Locale = "en" | "zh";

const navCopy = {
  en: {
    brand: "Global Bridge Compliance",
    solutions: "Solutions",
    toolkits: "Toolkits",
    insights: "Insights",
    intake: "Intake",
    procedure: "Procedure",
    review: "Private Review",
  },
  zh: {
    brand: "全球博译合规",
    solutions: "解决方案",
    toolkits: "工具包",
    insights: "情报库",
    intake: "资料收集",
    procedure: "交付程序",
    review: "私密评估",
  },
};

export default function SiteHeader({
  locale,
  setLocale,
}: {
  locale: Locale;
  setLocale: (locale: Locale) => void;
}) {
  const t = navCopy[locale];

  return (
    <header className="sticky top-0 z-50 border-b-[0.5px] border-slate-200 bg-slate-50/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6 lg:px-10">
        <a className="font-[family-name:var(--font-serif)] text-xl font-semibold text-blue-950" href="/">
          {t.brand}
        </a>
        <div className="flex items-center gap-6">
          <nav className="hidden items-center gap-8 text-[12px] font-bold uppercase tracking-[0.18em] text-slate-600 md:flex">
            <a className="transition-colors duration-300 hover:text-blue-950" href="/#services">
              {t.solutions}
            </a>
            <a className="transition-colors duration-300 hover:text-blue-950" href="/#products">
              {t.toolkits}
            </a>
            <a className="transition-colors duration-300 hover:text-blue-950" href="/insights">
              {t.insights}
            </a>
            <a className="transition-colors duration-300 hover:text-blue-950" href="/intake">
              {t.intake}
            </a>
            <a className="transition-colors duration-300 hover:text-blue-950" href="/#workflow">
              {t.procedure}
            </a>
            <a className="transition-colors duration-300 hover:text-blue-950" href="/#checkout">
              {t.review}
            </a>
          </nav>
          <LanguageToggle locale={locale} setLocale={setLocale} />
        </div>
      </div>
    </header>
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
