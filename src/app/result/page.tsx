"use client";
// 结果页在浏览器运行：需要读 localStorage，用 useEffect/useState

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { ProcessResult } from "@/app/page";

export default function ResultPage() {
  const router = useRouter();
  const [results, setResults] = useState<ProcessResult[]>([]);
  const [loaded, setLoaded] = useState(false);

  // useEffect 在组件挂载后才跑，确保在浏览器端读 localStorage
  // 服务端渲染阶段没有 localStorage，直接用会报错
  useEffect(() => {
    const raw = localStorage.getItem("lovely-shelf-results");
    if (raw) {
      setResults(JSON.parse(raw));
    }
    setLoaded(true);
  }, []);

  const successCount = results.filter((r) => r.status === "success").length;
  const errorCount = results.filter((r) => r.status === "error").length;

  // 没有数据时（直接访问 /result 或 localStorage 被清空）
  if (loaded && results.length === 0) {
    return (
      <div className="min-h-screen bg-shelf-50 flex flex-col items-center justify-center gap-4 px-4">
        <span className="text-5xl">📭</span>
        <p className="text-ink-muted text-sm">没有找到识别结果</p>
        <button
          onClick={() => router.push("/")}
          className="bg-shelf-500 hover:bg-shelf-600 text-white text-sm font-medium px-5 py-2.5 rounded-full transition-colors"
        >
          去上传图片
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-shelf-50">
      {/* ── Header ── */}
      <header className="bg-white border-b border-stone-100 px-5 py-4 flex items-center justify-between sticky top-0 z-20 shadow-sm">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-shelf-500 rounded-xl flex items-center justify-center shadow-sm">
            <span className="text-white text-sm">📚</span>
          </div>
          <span className="font-semibold text-ink text-lg tracking-tight">lovely-shelf</span>
        </div>
        {/* 汇总：几张成功几张失败 */}
        <div className="flex items-center gap-3 text-xs">
          {successCount > 0 && (
            <span className="bg-green-100 text-green-700 px-2.5 py-1 rounded-full font-medium">
              ✓ {successCount} 张成功
            </span>
          )}
          {errorCount > 0 && (
            <span className="bg-red-100 text-red-700 px-2.5 py-1 rounded-full font-medium">
              ✕ {errorCount} 张失败
            </span>
          )}
        </div>
      </header>

      <main className="max-w-xl mx-auto px-4 py-6">
        {/* 标题区 */}
        {loaded ? (
          <div className="text-center mb-6">
            <h1 className="text-xl font-bold text-ink mb-1">识别完成</h1>
            <p className="text-ink-muted text-sm">
              共 {results.length} 张，已自动写入 Notion 书库
            </p>
          </div>
        ) : (
          // loaded 前显示骨架，避免闪烁
          <div className="text-center mb-6 animate-pulse">
            <div className="h-6 bg-stone-200 rounded w-32 mx-auto mb-2" />
            <div className="h-4 bg-stone-100 rounded w-48 mx-auto" />
          </div>
        )}

        {/* ── 书籍卡片列表 ── */}
        <div className="space-y-4">
          {results.map((result, idx) => (
            <BookCard key={idx} result={result} />
          ))}
        </div>

        {/* ── 底部按钮 ── */}
        <div className="mt-8 flex flex-col gap-3">
          <button
            onClick={() => router.push("/")}
            className="w-full bg-shelf-500 hover:bg-shelf-600 active:bg-shelf-700 text-white font-semibold py-4 rounded-2xl transition-colors shadow-md text-base"
          >
            + 继续上传更多
          </button>
          <p className="text-center text-xs text-ink-light">
            结果已保存到 Notion，关闭页面不会丢失
          </p>
        </div>
      </main>
    </div>
  );
}

// ── 单张书卡片 ──
// 抽成独立组件：让代码结构清晰，每张卡自己管理展开/折叠状态
function BookCard({ result }: { result: ProcessResult }) {
  const { filename, previewUrl, status, bookInfo, pageUrl, error } = result;

  if (status === "error") {
    return (
      <div className="bg-white rounded-2xl border border-red-100 shadow-sm p-4 flex items-start gap-4">
        {/* 封面区 - 失败时显示占位 */}
        <div className="w-16 shrink-0 aspect-[3/4] bg-red-50 rounded-xl flex items-center justify-center text-2xl">
          ❌
        </div>
        <div className="flex-1 min-w-0 py-1">
          <p className="text-sm font-medium text-ink truncate">{filename}</p>
          <p className="text-xs text-red-500 mt-1">{error ?? "识别失败"}</p>
        </div>
      </div>
    );
  }

  // 成功状态
  const info = bookInfo!;
  return (
    <div className="bg-white rounded-2xl border border-stone-100 shadow-sm overflow-hidden">
      {/* 上半：封面 + 核心字段 */}
      <div className="flex gap-4 p-4">
        {/* 封面缩略图
            注意：previewUrl 是 blob: URL，只在当前标签页会话有效
            刷新页面后 blob 失效，图片会消失（这是浏览器限制，不是 bug）*/}
        <div className="w-20 shrink-0 aspect-[3/4] rounded-xl overflow-hidden bg-stone-100 shadow-sm">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewUrl}
            alt={info.title}
            className="w-full h-full object-cover"
            onError={(e) => {
              // blob 失效时降级显示占位图标
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
        </div>

        {/* 字段区 */}
        <div className="flex-1 min-w-0 space-y-1.5 py-0.5">
          <h2 className="font-bold text-ink text-base leading-tight line-clamp-2">
            {info.title}
          </h2>
          {info.subtitle && (
            <p className="text-ink-muted text-xs line-clamp-1">{info.subtitle}</p>
          )}
          <p className="text-sm text-ink-muted">{info.author}</p>

          {/* 标签行：国家 + 类型 */}
          <div className="flex flex-wrap gap-1.5 pt-0.5">
            {info.country && (
              <span className="bg-shelf-100 text-shelf-700 text-xs px-2 py-0.5 rounded-full">
                {info.country}
              </span>
            )}
            {info.genres.slice(0, 3).map((g) => (
              <span key={g} className="bg-stone-100 text-ink-muted text-xs px-2 py-0.5 rounded-full">
                {g}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* 下半：简介 + Notion 链接 */}
      <div className="border-t border-stone-50 px-4 py-3 bg-shelf-50/50">
        <p className="text-xs text-ink-muted leading-relaxed mb-3 line-clamp-2">
          {info.description}
        </p>

        {pageUrl && (
          <a
            href={pageUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-shelf-600 hover:text-shelf-700 transition-colors"
          >
            <span className="w-4 h-4 bg-shelf-100 rounded flex items-center justify-center text-[10px]">N</span>
            在 Notion 中查看
            <span className="text-shelf-400">→</span>
          </a>
        )}
      </div>
    </div>
  );
}
