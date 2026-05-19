"use client";

import { usePathname, useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { useLanguage } from "@/contexts/LanguageContext";

export default function NavBar() {
  const pathname = usePathname();
  const router   = useRouter();
  const { data: session } = useSession();

  const { lang, t, toggle } = useLanguage();

  // NAV_ITEMS 放在组件内，这样 label 能响应语言切换
  const NAV_ITEMS = [
    { href: "/upload",    icon: "📤", label: t.nav.upload },
    { href: "/dashboard", icon: "📊", label: t.nav.dashboard },
    { href: "/chat",      icon: "💬", label: t.nav.chat },
    { href: "/quotes",    icon: "✨", label: t.nav.quotes },
  ];
  const isDemo     = session?.user?.email === "demo@lovely-shelf.com";
  const firstName  = session?.user?.name?.split(" ")[0] ?? "";

  // /dashboard 和 /dashboard/genre/xxx 都算"书架"激活
  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  }

  return (
    <div className="sticky top-0 z-20">
      <header className="bg-white border-b border-stone-100 px-6 py-3 flex items-center gap-4 shadow-sm">
        {/* Logo */}
        <div className="flex items-center gap-2 shrink-0 mr-2">
          <div className="w-8 h-8 bg-shelf-500 rounded-xl flex items-center justify-center shadow-sm">
            <span className="text-white text-sm">📚</span>
          </div>
          <span className="font-semibold text-ink text-base tracking-tight hidden sm:block">
            lovely-shelf
          </span>
        </div>

        {/* 导航项 */}
        <nav className="flex items-center gap-1">
          {NAV_ITEMS.map(({ href, icon, label }) => {
            const active = isActive(href);
            return (
              <button
                key={href}
                type="button"
                onClick={() => router.push(href)}
                className={`flex items-center justify-center gap-1.5 w-20 py-2 rounded-xl text-sm font-medium transition-colors ${
                  active
                    ? "bg-shelf-100 text-shelf-700"
                    : "text-ink-muted hover:bg-stone-100 hover:text-ink"
                }`}
              >
                <span className="text-base leading-none">{icon}</span>
                {label}
              </button>
            );
          })}
        </nav>

        {/* 右侧操作区 */}
        <div className="ml-auto flex items-center gap-2">
          {/* 真实账号显示名字 */}
          {session && !isDemo && (
            <span className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full bg-shelf-100 text-shelf-700 text-xs font-medium">
              👤 {firstName || session.user?.email}
            </span>
          )}

          {/* 语言切换 */}
          <button
            type="button"
            onClick={toggle}
            className="flex items-center justify-center w-10 h-9 rounded-xl text-sm font-medium text-ink-muted hover:bg-stone-100 hover:text-ink transition-colors border border-stone-200"
          >
            {lang === "zh" ? "EN" : "中"}
          </button>

          {/* 退出登录 */}
          <button
            type="button"
            onClick={() => {
              localStorage.removeItem("lovely-shelf-results");
              signOut({ callbackUrl: "/login" });
            }}
            className="flex items-center justify-center gap-1.5 w-24 py-2 rounded-xl text-sm font-medium text-ink-muted hover:bg-red-50 hover:text-red-500 transition-colors"
          >
            <span className="text-base leading-none">🚪</span>
            <span className="hidden sm:block">{t.nav.signOut}</span>
          </button>
        </div>
      </header>

      {/* Demo 模式提示条：清晰可见，不会误以为是真实数据 */}
      {isDemo && (
        <div className="bg-amber-400 px-4 py-1.5 flex items-center justify-center gap-2 text-amber-900 text-xs font-medium">
          <span>🎪</span>
          <span>{t.demo.banner}</span>
        </div>
      )}
    </div>
  );
}
