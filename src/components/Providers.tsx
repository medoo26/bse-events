"use client";

import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from "react";
import { dict, Key, Lang } from "@/lib/i18n";

interface Ctx {
  lang: Lang;
  setLang: (l: Lang) => void;
  dark: boolean;
  toggleDark: () => void;
  t: (k: Key) => string;
}

const AppCtx = createContext<Ctx | null>(null);

export function Providers({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("ar");
  const [dark, setDark] = useState(false);

  useEffect(() => {
    try {
      const l = localStorage.getItem("bse_lang") as Lang | null;
      if (l === "ar" || l === "en") setLangState(l);
      if (localStorage.getItem("bse_dark") === "1") setDark(true);
    } catch {}
  }, []);

  useEffect(() => {
    const el = document.documentElement;
    el.lang = lang;
    el.dir = lang === "ar" ? "rtl" : "ltr";
    el.classList.toggle("dark", dark);
  }, [lang, dark]);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try {
      localStorage.setItem("bse_lang", l);
    } catch {}
  }, []);
  const toggleDark = useCallback(() => {
    setDark((d) => {
      try {
        localStorage.setItem("bse_dark", d ? "0" : "1");
      } catch {}
      return !d;
    });
  }, []);
  const t = useCallback((k: Key) => dict[lang][k], [lang]);

  return <AppCtx.Provider value={{ lang, setLang, dark, toggleDark, t }}>{children}</AppCtx.Provider>;
}

export function useApp() {
  const c = useContext(AppCtx);
  if (!c) throw new Error("useApp must be used inside Providers");
  return c;
}
