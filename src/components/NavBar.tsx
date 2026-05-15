"use client";

import { usePathname, useRouter } from "next/navigation";
import { signOut } from "next-auth/react";

// 导航项配置：href 用来判断哪个是当前页
const NAV_ITEMS = [
  { href: "/",          icon: "📤", label: "上传" },
  { href: "/dashboard", icon: "📊", label: "书架" },
];

export default function NavBar() {
  const pathname = usePathname();
  const router = useRouter();

  // /dashboard 和 /dashboard/genre/xxx 都算"书架"激活
  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  }

  return (
    <header className="bg-white border-b border-stone-100 px-6 py-3 flex items-center gap-4 sticky top-0 z-20 shadow-sm">
      {/* Logo */}
      <div className="flex items-center gap-2 shrink-0 mr-2">
        <div className="w-8 h-8 bg-shelf-500 rounded-xl flex items-center justify-center shadow-sm">
          <span className="text-white text-sm">📚</span>
        </div>
        <span className="font-semibold text-ink text-base tracking-tight hidden sm:block">
          lovely-shelf
        </span>
      </div>

      {/* 导航项：居中放，不顶到最右 */}
      <nav className="flex items-center gap-1">
        {NAV_ITEMS.map(({ href, icon, label }) => {
          const active = isActive(href);
          return (
            <button
              key={href}
              type="button"
              onClick={() => router.push(href)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-medium transition-colors ${
                active
                  ? "bg-shelf-100 text-shelf-700"          // 当前页：高亮背景 + 深色文字
                  : "text-ink-muted hover:bg-stone-100 hover:text-ink"  // 其他页：灰色，hover 时浅背景
              }`}
            >
              <span className="text-base leading-none">{icon}</span>
              {label}
            </button>
          );
        })}
      </nav>

      {/* 右侧操作区 */}
      <div className="ml-auto flex items-center gap-1">
        {/* 退出登录 */}
        <button
          type="button"
          onClick={() => {
            localStorage.removeItem("lovely-shelf-results");
            signOut({ callbackUrl: "/login" });
          }}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-medium text-ink-muted hover:bg-red-50 hover:text-red-500 transition-colors"
        >
          <span className="text-base leading-none">🚪</span>
          <span className="hidden sm:block">退出</span>
        </button>
      </div>
    </header>
  );
}
