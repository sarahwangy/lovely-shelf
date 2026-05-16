"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import NavBar from "@/components/NavBar";
import type { QuoteBook } from "@/app/api/quotes/route";

// QuoteStudio 依赖 html2canvas（需要 DOM API），必须关闭 SSR
const QuoteStudio = dynamic(() => import("./QuoteStudio"), { ssr: false });

// ── 工具函数 ─────────────────────────────────────────────────────

function likeKey(pageId: string, idx: number) {
  return `q:${pageId}:${idx}`;
}

const LIKES_STORAGE_KEY = "lovely-shelf-liked-quotes";

function loadLikes(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(LIKES_STORAGE_KEY);
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
  } catch {
    return new Set();
  }
}

function saveLikes(likes: Set<string>) {
  localStorage.setItem(LIKES_STORAGE_KEY, JSON.stringify([...likes]));
}

// ── 主页面 ───────────────────────────────────────────────────────

// StudioTarget 描述"打开语录卡制作室时的初始状态"
// canSave=true → 新增模式（显示"保存到 Notion"按钮）
// canSave=false → 编辑导出模式（只能改背景 / 导出 PNG）
type StudioTarget = {
  initialText:      string;
  initialBookTitle: string;
  initialAuthor:    string;
  canSave:          boolean;
};

export default function QuotesPage() {
  const [books,   setBooks]   = useState<QuoteBook[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [likes,   setLikes]   = useState<Set<string>>(new Set());
  const [studio,  setStudio]  = useState<StudioTarget | null>(null);

  useEffect(() => {
    setLikes(loadLikes());
    fetch("/api/quotes")
      .then((r) => r.json())
      .then((data: { books: QuoteBook[]; error?: string }) => {
        if (data.error) throw new Error(data.error);
        setBooks(data.books);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  function toggleLike(key: string) {
    setLikes((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      saveLikes(next);
      return next;
    });
  }

  // 新语录保存后：乐观更新插到列表最前面，关闭制作室
  function handleQuoteSaved(book: QuoteBook) {
    setBooks((prev) => [book, ...prev]);
    setStudio(null);
  }

  const allQuotes = books.flatMap((book) =>
    book.quotes.map((text, idx) => ({ text, idx, book }))
  );

  return (
    <div className="min-h-screen bg-stone-50">
      <NavBar />

      <main className="max-w-2xl mx-auto px-4 py-8">
        <div className="mb-8">
          {/* 标题行：左边文字，右边 + 按钮 */}
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold text-ink mb-1">语录</h1>
              <p className="text-sm text-ink-muted leading-relaxed">
                这里是你治愈心灵、平静内心的小天地
                <span className="mx-1.5">·</span>
                共 {allQuotes.length} 句
              </p>
            </div>
            {/* + 按钮：打开"新增"模式的制作室 */}
            <button
              type="button"
              onClick={() => setStudio({ initialText: "", initialBookTitle: "", initialAuthor: "", canSave: true })}
              className="shrink-0 w-9 h-9 bg-shelf-500 hover:bg-shelf-600 text-white rounded-full shadow flex items-center justify-center text-xl transition-colors"
              aria-label="添加语录"
            >
              +
            </button>
          </div>
        </div>

        {loading && <div className="text-center py-20 text-ink-muted">加载中…</div>}
        {error   && <div className="text-center py-20 text-red-400">{error}</div>}

        {!loading && !error && allQuotes.length === 0 && (
          <div className="text-center py-20 text-ink-muted">
            <p className="text-4xl mb-3">✨</p>
            <p>还没有语录，去上传第一本书，或点击右上角 + 手动添加</p>
          </div>
        )}

        {allQuotes.length > 0 && (
          <div className="flex flex-col gap-4">
            {allQuotes.map(({ text, idx, book }) => {
              const key = likeKey(book.pageId, idx);
              return (
                <QuoteCard
                  key={key}
                  text={text}
                  book={book}
                  liked={likes.has(key)}
                  onToggle={() => toggleLike(key)}
                  // 🎨 按钮：打开"导出"模式，文字预填，不显示保存按钮
                  onMakeCard={() => setStudio({
                    initialText:      text,
                    initialBookTitle: book.bookTitle,
                    initialAuthor:    book.author,
                    canSave:          false,
                  })}
                />
              );
            })}
          </div>
        )}
      </main>

      {/* 语录卡制作室（兼顾新增保存 + 编辑导出两种模式）*/}
      {studio && (
        <QuoteStudio
          initialText={studio.initialText}
          initialBookTitle={studio.initialBookTitle}
          initialAuthor={studio.initialAuthor}
          onSaved={studio.canSave ? handleQuoteSaved : undefined}
          onClose={() => setStudio(null)}
        />
      )}
    </div>
  );
}

// ── 语录卡片 ─────────────────────────────────────────────────────

function QuoteCard({
  text, book, liked, onToggle, onMakeCard,
}: {
  text:       string;
  book:       QuoteBook;
  liked:      boolean;
  onToggle:   () => void;
  onMakeCard: () => void;
}) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-stone-100 p-5 flex gap-4">
      {book.coverUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={book.coverUrl} alt={book.bookTitle}
          className="w-12 h-16 object-cover rounded-lg shrink-0 shadow-sm" />
      ) : (
        <div className="w-12 h-16 bg-shelf-100 rounded-lg shrink-0 flex items-center justify-center">
          <span className="text-lg">📚</span>
        </div>
      )}

      <div className="flex-1 min-w-0">
        <p className="text-ink text-base leading-relaxed border-l-2 border-shelf-300 pl-3 mb-3">
          {text}
        </p>
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            {/* 已收藏标签 */}
            {liked && (
              <span className="inline-flex items-center gap-1 text-xs text-red-500 mb-1">
                <svg viewBox="0 0 24 24" className="w-3 h-3 fill-current shrink-0">
                  <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                </svg>
                已收藏
              </span>
            )}
            <a href={book.notionUrl} target="_blank" rel="noopener noreferrer"
              className="text-sm font-medium text-shelf-600 hover:underline truncate block">
              {book.bookTitle}
            </a>
            {book.author && <p className="text-xs text-ink-muted mt-0.5">{book.author}</p>}
            {/* 音乐 / 视频链接 */}
            <div className="flex gap-2 mt-1 flex-wrap">
              {book.musicUrl && (
                <a href={book.musicUrl} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-ink-muted hover:text-shelf-600 transition-colors">
                  🎵 音乐
                </a>
              )}
              {book.videoUrl && (
                <a href={book.videoUrl} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-ink-muted hover:text-shelf-600 transition-colors">
                  🎬 视频
                </a>
              )}
            </div>
          </div>

          {/* 制作卡片按钮 */}
          <button type="button" onClick={onMakeCard} title="制作语录卡"
            className="shrink-0 w-8 h-8 flex items-center justify-center rounded-full text-stone-300 hover:text-shelf-500 hover:bg-shelf-50 transition-colors text-base">
            🎨
          </button>

          {/* 收藏按钮 */}
          <button type="button" onClick={onToggle}
            aria-label={liked ? "取消收藏" : "收藏"}
            className={`shrink-0 w-8 h-8 flex items-center justify-center rounded-full transition-colors ${
              liked ? "text-red-500 bg-red-50 hover:bg-red-100"
                    : "text-stone-300 hover:text-red-400 hover:bg-red-50"
            }`}>
            {liked ? (
              <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current">
                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
