"use client";
// 结果页在浏览器运行：需要读 localStorage，用 useEffect/useState

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { ProcessResult } from "@/app/page";
import type { BookSummary } from "@/types/book";
import BookDetailModal from "@/components/BookDetailModal";

export default function ResultPage() {
  const router = useRouter();
  const [results, setResults] = useState<ProcessResult[]>([]);
  const [loaded, setLoaded] = useState(false);
  // 当前打开 modal 的书籍 pageId，null = 关闭
  const [modalPageId, setModalPageId] = useState<string | null>(null);

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
  const duplicateCount = results.filter((r) => r.status === "duplicate").length;
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
              ✓ {successCount} 张入库
            </span>
          )}
          {duplicateCount > 0 && (
            <span className="bg-amber-100 text-amber-700 px-2.5 py-1 rounded-full font-medium">
              ⚠ {duplicateCount} 张重复
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
            <BookCard key={idx} result={result} onBookClick={setModalPageId} />
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

      {/* modal 挂在页面根节点，确保层级高于所有内容 */}
      <BookDetailModal
        pageId={modalPageId}
        onClose={() => setModalPageId(null)}
      />
    </div>
  );
}

// ── 单张书卡片 ──
// 抽成独立组件：让代码结构清晰，每张卡自己管理展开/折叠状态
function BookCard({
  result,
  onBookClick,
}: {
  result: ProcessResult;
  onBookClick: (pageId: string) => void;
}) {
  const { filename, previewUrl, status, bookInfo, pageUrl, error, stats } = result;

  if (status === "error") {
    return (
      <div className="bg-white rounded-2xl border border-red-100 shadow-sm p-4 flex items-start gap-4">
        <div className="w-16 shrink-0 aspect-[3/4] bg-red-50 rounded-xl flex items-center justify-center text-2xl">
          ❌
        </div>
        <div className="flex-1 min-w-0 py-1">
          <p className="text-sm font-medium text-ink truncate">{filename}</p>
          <p className="text-xs text-red-500 mt-1 line-clamp-3">{error ?? "识别失败"}</p>
        </div>
      </div>
    );
  }

  if (status === "duplicate") {
    return (
      <div className="bg-white rounded-2xl border border-amber-100 shadow-sm p-4 flex items-start gap-4">
        <div className="w-16 shrink-0 aspect-[3/4] bg-amber-50 rounded-xl flex items-center justify-center text-2xl">
          📖
        </div>
        <div className="flex-1 min-w-0 py-1">
          <p className="text-sm font-medium text-ink truncate">{bookInfo?.title ?? filename}</p>
          <p className="text-xs text-ink-muted mt-0.5">{bookInfo?.author}</p>
          <p className="text-xs text-amber-600 mt-1.5 font-medium">已在书库中，跳过入库</p>
          {pageUrl && (
            <a
              href={pageUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-shelf-600 hover:text-shelf-700 mt-2 py-1"
            >
              <span className="w-4 h-4 bg-shelf-100 rounded flex items-center justify-center text-[10px] shrink-0">N</span>
              查看已有记录 →
            </a>
          )}
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
          // py-2 把点击区域撑高到 ~32px，符合 Apple HIG 的最小触摸目标建议
          <a
            href={pageUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm font-medium text-shelf-600 hover:text-shelf-700 active:text-shelf-800 transition-colors py-2"
          >
            <span className="w-5 h-5 bg-shelf-100 rounded flex items-center justify-center text-xs shrink-0">N</span>
            在 Notion 中查看
            <span className="text-shelf-400">→</span>
          </a>
        )}

        {/* 成就感提示：入库成功且后端返回了同类书统计时显示 */}
        {stats && (
          <div className="mt-3 bg-gradient-to-r from-shelf-500 to-shelf-600 rounded-xl px-4 py-3 flex items-center gap-3">
            <span className="text-xl shrink-0">
              {stats.countInGenre === 1 ? "🎊" : "🎉"}
            </span>
            <p className="text-white text-sm leading-snug">
              {stats.countInGenre === 1
                ? <>这是你书库里第一本 <span className="font-bold">{stats.primaryGenre}</span> 类的书！</>
                : <>这是你第 <span className="font-bold text-base">{stats.countInGenre}</span> 本 <span className="font-bold">{stats.primaryGenre}</span> 类的书～</>
              }
            </p>
          </div>
        )}

        {/* 同类书推荐：同类书 ≥ 2 本才显示（1本时就是刚入库的自己，没意义） */}
        {result.recommendations && result.recommendations.length > 0 && (
          <RecommendationRow
            genre={stats?.primaryGenre ?? ""}
            books={result.recommendations}
            onBookClick={onBookClick}
          />
        )}
      </div>
    </div>
  );
}

// ── 同类书推荐横向滚动区块 ──
function RecommendationRow({
  genre,
  books,
  onBookClick,
}: {
  genre: string;
  books: BookSummary[];
  onBookClick: (pageId: string) => void;
}) {
  return (
    <div className="mt-4 -mx-4 px-4">
      <p className="text-xs font-medium text-ink-muted mb-2.5">
        📚 你的{genre}书架
      </p>
      {/* overflow-x-auto 横向滚动，scrollbar-hide 隐藏滚动条 */}
      <div className="flex gap-3 overflow-x-auto pb-2" style={{ scrollbarWidth: "none" }}>
        {books.map((book) => (
          <RecommendationCard key={book.pageId} book={book} onBookClick={onBookClick} />
        ))}
      </div>
    </div>
  );
}

// ── 单本推荐卡片 ──
// 改成 button：点击弹 modal，不再跳 Notion 新标签
function RecommendationCard({
  book,
  onBookClick,
}: {
  book: BookSummary;
  onBookClick: (pageId: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onBookClick(book.pageId)}
      className="shrink-0 w-24 group text-left"
    >
      {/* 封面图：固定宽高，object-cover 保持比例裁剪 */}
      <div className="w-24 h-32 rounded-xl overflow-hidden bg-stone-100 shadow-sm mb-1.5 group-hover:shadow-md transition-shadow">
        {book.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={book.coverUrl}
            alt={book.title}
            className="w-full h-full object-cover"
            onError={(e) => {
              // 封面 URL 过期时（Notion S3 链接约 1 小时有效）降级到占位
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-2xl bg-shelf-50">
            📖
          </div>
        )}
      </div>
      <p className="text-xs text-ink font-medium line-clamp-2 leading-snug">{book.title}</p>
      <p className="text-xs text-ink-muted mt-0.5 truncate">{book.author}</p>
    </button>
  );
}
