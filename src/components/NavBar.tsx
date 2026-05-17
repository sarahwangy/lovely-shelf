"use client";

import { usePathname, useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";

// 导航项配置：href 用来判断哪个是当前页
const NAV_ITEMS = [
  { href: "/upload",    icon: "📤", label: "上传" },
  { href: "/dashboard", icon: "📊", label: "书架" },
  { href: "/chat",      icon: "💬", label: "聊天" },
  { href: "/quotes",    icon: "✨", label: "语录" },
];

export default function NavBar() {
  const pathname = usePathname();
  const router   = useRouter();
  const { data: session } = useSession();

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
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-medium transition-colors ${
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

      {/* Demo 模式提示条：清晰可见，不会误以为是真实数据 */}
      {isDemo && (
        <div className="bg-amber-400 px-4 py-1.5 flex items-center justify-center gap-2 text-amber-900 text-xs font-medium">
          <span>🎪</span>
          <span>Demo 模式 · 当前展示的是示例数据，不会读写你的 Notion</span>
        </div>
      )}
    </div>
  );
}
