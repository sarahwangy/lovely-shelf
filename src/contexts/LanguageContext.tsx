"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
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
  // 初始语言从 localStorage 读取，没有则默认中文
  const [lang, setLang] = useState<Language>(() => {
    if (typeof window === "undefined") return "zh";
    return (localStorage.getItem("lovely-shelf-lang") as Language) ?? "zh";
  });

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
