"use client";

import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import zh from "@/lib/i18n/zh";
import en from "@/lib/i18n/en";
import type { Translations } from "@/lib/i18n/zh";

type Language = "zh" | "en";

interface LanguageContextValue {
  lang: Language;
  t: Translations;
  toggle: () => void;
}

// createContext 创建一个"全局共享的盒子"，所有子组件都能从里面取值
const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  // 服务端和客户端都先用 "zh"，避免 hydration 不匹配
  // mount 之后再从 localStorage 读实际存储的语言
  const [lang, setLang] = useState<Language>("zh");

  useEffect(() => {
    const stored = localStorage.getItem("lovely-shelf-lang");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (stored === "en" || stored === "zh") setLang(stored);
  }, []);

  const translations = lang === "zh" ? zh : en;

  function toggle() {
    const next = lang === "zh" ? "en" : "zh";
    setLang(next);
    localStorage.setItem("lovely-shelf-lang", next);
  }

  return (
    <LanguageContext.Provider value={{ lang, t: translations, toggle }}>
      {children}
    </LanguageContext.Provider>
  );
}

// useLanguage：在任意组件里调用，拿到 t（翻译对象）和 toggle（切换函数）
export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used inside LanguageProvider");
  return ctx;
}
