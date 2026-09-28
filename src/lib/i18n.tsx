import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type Lang = "ar" | "en";
const KEY = "app-lang";

interface Ctx {
  lang: Lang;
  setLang: (l: Lang) => void;
  /** Pick the string for the current language: t("Orders", "الطلبات"). */
  t: (en: string, ar: string) => string;
}

const LangCtx = createContext<Ctx>({ lang: "ar", setLang: () => {}, t: (_e, a) => a });

/** Runs before paint so the page direction never flickers. */
export const LANG_BOOTSTRAP = `(function(){try{var l=localStorage.getItem('${KEY}')==='en'?'en':'ar';var h=document.documentElement;h.lang=l;h.dir=l==='ar'?'rtl':'ltr';}catch(e){}})();`;

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("ar");

  useEffect(() => {
    try {
      if (localStorage.getItem(KEY) === "en") setLangState("en");
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    const h = document.documentElement;
    h.lang = lang;
    h.dir = lang === "ar" ? "rtl" : "ltr";
  }, [lang]);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try {
      localStorage.setItem(KEY, l);
    } catch {
      /* ignore */
    }
  }, []);

  const value = useMemo<Ctx>(
    () => ({ lang, setLang, t: (en, ar) => (lang === "ar" ? ar : en) }),
    [lang, setLang],
  );
  return <LangCtx.Provider value={value}>{children}</LangCtx.Provider>;
}

export function useLang() {
  return useContext(LangCtx);
}

export function LangToggle() {
  const { lang, setLang } = useLang();
  return (
    <button
      type="button"
      onClick={() => setLang(lang === "ar" ? "en" : "ar")}
      className="panel px-3 py-1.5 text-xs font-semibold"
      aria-label={lang === "ar" ? "Switch to English" : "التبديل إلى العربية"}
    >
      {lang === "ar" ? "English" : "العربية"}
    </button>
  );
}
