"use client";

import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LoginPage() {
  const router = useRouter();
  const [demoLoading, setDemoLoading] = useState(false);

  async function handleDemo() {
    setDemoLoading(true);
    const result = await signIn("credentials", { redirect: false });
    if (result?.ok) {
      // router.refresh() 强制 Next.js 带着最新 cookie 重新拉一遍服务端组件
      // 这样 layout.tsx 里的 await auth() 就能立刻拿到 demo session
      // banner 第一帧就出现，不需要再手动 F5
      router.refresh();
      router.push("/upload");
    } else {
      setDemoLoading(false);
    }
  }

  return (
    <div className="min-h-dvh flex items-center justify-center bg-shelf-50 px-4">
      <div className="bg-white rounded-2xl shadow-sm border border-stone-100 p-8 w-full max-w-sm text-center">
        {/* Logo */}
        <div className="w-14 h-14 bg-shelf-500 rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-sm">
          <span className="text-2xl">📚</span>
        </div>
        <h1 className="text-xl font-bold text-ink mb-1">lovely-shelf</h1>
        <p className="text-sm text-ink-muted mb-8">把书封面变成书库</p>

        {/* Google 登录：真实数据（书架主人专用）*/}
        {/* signIn("google") 会整页跳转到 Google，回来后是完整页面加载，不存在 cookie 竞态 */}
        <button
          type="button"
          onClick={() => signIn("google", { callbackUrl: "/upload" })}
          className="w-full flex items-center justify-center gap-3 bg-white border-2 border-stone-200 hover:border-shelf-300 hover:bg-shelf-50 text-ink font-medium py-3 px-4 rounded-xl transition-colors"
        >
          <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          使用 Google 账号登录
        </button>

        {/* 分隔线 */}
        <div className="flex items-center gap-3 my-4">
          <div className="flex-1 h-px bg-stone-100" />
          <span className="text-xs text-ink-muted">或</span>
          <div className="flex-1 h-px bg-stone-100" />
        </div>

        {/* Demo 体验：种子假数据，面试官/访客专用 */}
        <button
          type="button"
          onClick={handleDemo}
          disabled={demoLoading}
          className="w-full flex items-center justify-center gap-2 bg-shelf-500 hover:bg-shelf-600 disabled:opacity-60 text-white font-medium py-3 px-4 rounded-xl transition-colors"
        >
          {demoLoading ? "登录中…" : "🎪 一键体验 Demo"}
        </button>

        <p className="text-xs text-ink-muted mt-3">
          Demo 模式 · 展示示例数据，无需账号
        </p>
      </div>
    </div>
  );
}
