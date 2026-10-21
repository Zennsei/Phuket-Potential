import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Lang = "th" | "en";

interface I18n {
  lang: Lang;
  setLang: (l: Lang) => void;
  /** pick the Thai or English text */
  t: (th: string, en: string) => string;
  num: (n: number, digits?: number) => string;
}

const Ctx = createContext<I18n | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>(() => {
    try {
      return (localStorage.getItem("lang") as Lang) || "th";
    } catch {
      return "th";
    }
  });
  useEffect(() => {
    document.documentElement.lang = lang;
    try {
      localStorage.setItem("lang", lang);
    } catch {
      /* storage unavailable */
    }
  }, [lang]);
  const value: I18n = {
    lang,
    setLang,
    t: (th, en) => (lang === "th" ? th : en),
    num: (n, digits = 0) =>
      n.toLocaleString(lang === "th" ? "th-TH" : "en-US", {
        maximumFractionDigits: digits,
        minimumFractionDigits: digits,
      }),
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n(): I18n {
  const v = useContext(Ctx);
  if (!v) throw new Error("useI18n must be used inside I18nProvider");
  return v;
}
