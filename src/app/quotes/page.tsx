"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import NavBar from "@/components/NavBar";
import type { QuoteBook } from "@/app/api/quotes/route";
import type { CardStyle } from "./QuoteStudio";

// QuoteStudio 依赖 DOM API，必须关闭 SSR
const QuoteStudio = dynamic(() => import("./QuoteStudio"), { ssr: false });

// ── 工具函数 ─────────────────────────────────────────────────────

function likeKey(pageId: string, idx: number) {
  return `q:${pageId}:${idx}`;
}

function cardStyleKey(pageId: string, idx: number) {
  return `qs-style:${pageId}:${idx}`;
}

const LIKES_STORAGE_KEY = "lovely-shelf-liked-quotes";

function loadLikes(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(LIKES_STORAGE_KEY);
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
  } catch { return new Set(); }
}

function saveLikes(likes: Set<string>) {
  localStorage.setItem(LIKES_STORAGE_KEY, JSON.stringify([...likes]));
}

function loadCardStyle(key: string): CardStyle | undefined {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as CardStyle) : undefined;
  } catch { return undefined; }
}

// ── 导出所有语录 ─────────────────────────────────────────────────

function dlFile(content: string, filename: string, type: string) {
  const blob = new Blob(["﻿" + content], { type: `${type};charset=utf-8` });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function exportMarkdown(allQuotes: { text: string; book: QuoteBook }[]) {
  const date = new Date().toLocaleDateString("zh-CN");
  const byBook = new Map<string, { book: QuoteBook; texts: string[] }>();
  for (const { text, book } of allQuotes) {
    const entry = byBook.get(book.pageId);
    if (entry) entry.texts.push(text);
    else byBook.set(book.pageId, { book, texts: [text] });
  }
  let md = `# 语录导出 · ${date}\n\n`;
  for (const { book, texts } of byBook.values()) {
    md += `## 《${book.bookTitle}》`;
    if (book.author) md += ` — ${book.author}`;
    md += "\n\n";
    for (const t of texts) md += `> ${t}\n\n`;
    md += "---\n\n";
  }
  dlFile(md, `语录-${date}.md`, "text/markdown");
}

function exportTSV(allQuotes: { text: string; book: QuoteBook }[]) {
  const header = "语录\t来源书名\t作者\tNotion链接";
  const rows = allQuotes.map(({ text, book }) =>
    [text, book.bookTitle, book.author, book.notionUrl].join("\t")
  );
  const date = new Date().toLocaleDateString("zh-CN");
  dlFile([header, ...rows].join("\n"), `语录-${date}.tsv`, "text/tab-separated-values");
}

// ── 主页面 ───────────────────────────────────────────────────────

// StudioTarget 描述"打开语录卡制作室时的初始状态"
type StudioTarget = {
  initialText:      string;
  initialBookTitle: string;
  initialAuthor:    string;
  canSave:          boolean;
  styleKey?:        string;       // localStorage key，制作室用来保存/读取样式
  initialStyle?:    CardStyle;    // 上次使用的样式（若有）
  onTextChanged?:   (newText: string) => void; // 文字被修改时更新本地卡片显示
};

const QUOTES_PAGE_SIZE = 10;

export default function QuotesPage() {
  const [books,      setBooks]      = useState<QuoteBook[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState<string | null>(null);
  const [likes,      setLikes]      = useState<Set<string>>(new Set());
  const [studio,     setStudio]     = useState<StudioTarget | null>(null);
  const [showExport, setShowExport] = useState(false);
  const [tab,        setTab]        = useState<"all" | "manual" | "notion" | "liked">("all");
  const [quotePage,  setQuotePage]  = useState(1);

  // tab 切换时回到第一页
  useEffect(() => { setQuotePage(1); }, [tab]);

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
      if (next.has(key)) next.delete(key); else next.add(key);
      saveLikes(next);
      return next;
    });
  }

  function handleQuoteSaved(book: QuoteBook) {
    setBooks((prev) => {
      // 若"手动语录"页已在列表中，替换它（追加了新语句）；否则插到最前面
      const exists = prev.some((b) => b.pageId === book.pageId);
      return exists
        ? prev.map((b) => (b.pageId === book.pageId ? book : b))
        : [book, ...prev];
    });
    setStudio(null);
  }

  function openStudio(text: string, book: QuoteBook, idx: number) {
    const key   = cardStyleKey(book.pageId, idx);
    const saved = loadCardStyle(key);
    setStudio({
      initialText:      text,
      initialBookTitle: book.bookTitle,
      initialAuthor:    book.author,
      canSave:          false,
      styleKey:         key,
      initialStyle:     saved,
      onTextChanged: (newText: string) => {
        // 先更新本地显示（立即生效，不等网络）
        setBooks((prev) =>
          prev.map((b) =>
            b.pageId !== book.pageId ? b : {
              ...b,
              quotes: b.quotes.map((q, i) => (i === idx ? newText : q)),
            }
          )
        );
        // 手动语录才同步到 Notion（书库语录的文字不写回）
        if (book.bookTitle === "手动语录") {
          fetch("/api/quotes", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ pageId: book.pageId, quoteIdx: idx, newText }),
          }).catch((e) => console.warn("[updateManualQuote]", e));
        }
      },
    });
  }

  const allQuotes = books.flatMap((book) =>
    book.quotes.map((text, idx) => ({ text, idx, book }))
  );

  const filteredQuotes = allQuotes.filter(({ text, idx, book }) => {
    if (tab === "manual") return book.bookTitle === "手动语录";
    if (tab === "notion") return book.bookTitle !== "手动语录";
    if (tab === "liked")  return likes.has(likeKey(book.pageId, idx));
    return true; // "all"
  });

  const totalQuotePages = Math.ceil(filteredQuotes.length / QUOTES_PAGE_SIZE);
  const visibleQuotes   = filteredQuotes.slice(
    (quotePage - 1) * QUOTES_PAGE_SIZE,
    quotePage * QUOTES_PAGE_SIZE
  );

  const TABS: { key: typeof tab; label: string; icon: string }[] = [
    { key: "all",    label: "全部",    icon: "📖" },
    { key: "manual", label: "手写",    icon: "✍️" },
    { key: "notion", label: "书库语录", icon: "📚" },
    { key: "liked",  label: "已收藏",  icon: "❤️" },
  ];

  return (
    <div className="min-h-screen bg-shelf-50">
      <NavBar />

      <main className="max-w-2xl mx-auto px-4 py-8">
        <div className="mb-8">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold text-ink mb-1">语录</h1>
              <p className="text-sm text-ink-muted leading-relaxed">
                这里是你治愈心灵、平静内心的小天地
                <span className="mx-1.5">·</span>
                {tab === "all" ? `共 ${allQuotes.length} 句` : `${filteredQuotes.length} / ${allQuotes.length} 句`}
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {/* 导出按钮（下拉）*/}
              {allQuotes.length > 0 && (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowExport((v) => !v)}
                    className="h-9 px-3 rounded-xl border border-stone-200 text-sm text-ink-muted hover:text-ink hover:border-stone-300 transition-colors flex items-center gap-1"
                  >
                    ⬇ 导出全部
                    <span className="text-[10px] text-stone-400">{showExport ? "▲" : "▼"}</span>
                  </button>
                  {showExport && (
                    <div className="absolute right-0 top-full mt-1 bg-white border border-stone-100 rounded-xl shadow-lg py-1 z-10 min-w-[120px]">
                      <button
                        type="button"
                        onClick={() => { exportMarkdown(allQuotes); setShowExport(false); }}
                        className="w-full text-left px-4 py-2 text-sm text-ink hover:bg-stone-50 transition-colors"
                      >
                        📝 Markdown
                      </button>
                      <button
                        type="button"
                        onClick={() => { exportTSV(allQuotes); setShowExport(false); }}
                        className="w-full text-left px-4 py-2 text-sm text-ink hover:bg-stone-50 transition-colors"
                      >
                        📊 表格 (TSV)
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* + 新增语录 */}
              <button
                type="button"
                onClick={() => setStudio({ initialText: "", initialBookTitle: "", initialAuthor: "", canSave: true })}
                className="w-9 h-9 bg-shelf-500 hover:bg-shelf-600 text-white rounded-full shadow flex items-center justify-center text-xl transition-colors"
                aria-label="添加语录"
              >
                +
              </button>
            </div>
          </div>
        </div>

        {/* Tab 切换栏 */}
        {!loading && !error && allQuotes.length > 0 && (
          <div className="flex gap-1 bg-stone-100 rounded-2xl p-1 mb-6">
            {TABS.map(({ key, label, icon }) => (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-medium transition-colors ${
                  tab === key
                    ? "bg-white text-ink shadow-sm"
                    : "text-ink-muted hover:text-ink"
                }`}
              >
                <span className="text-base leading-none">{icon}</span>
                {label}
              </button>
            ))}
          </div>
        )}

        {loading && <div className="text-center py-20 text-ink-muted">加载中…</div>}
        {error   && <div className="text-center py-20 text-red-400">{error}</div>}

        {!loading && !error && allQuotes.length === 0 && (
          <div className="text-center py-20 text-ink-muted">
            <p className="text-4xl mb-3">✨</p>
            <p>还没有语录，去上传第一本书，或点击右上角 + 手动添加</p>
          </div>
        )}

        {!loading && !error && allQuotes.length > 0 && filteredQuotes.length === 0 && (
          <div className="text-center py-16 text-ink-muted">
            <p className="text-3xl mb-3">
              {tab === "manual" ? "✍️" : tab === "liked" ? "🤍" : "📚"}
            </p>
            <p className="text-sm">
              {tab === "manual" ? "还没有手写语录，点击 + 手动添加" :
               tab === "liked"  ? "还没有收藏，点击语录卡上的心形收藏" :
                                  "还没有书库语录，去上传书籍后会自动同步"}
            </p>
          </div>
        )}

        {filteredQuotes.length > 0 && (
          <>
            <div className="flex flex-col gap-4">
              {visibleQuotes.map(({ text, idx, book }) => {
                const key = likeKey(book.pageId, idx);
                return (
                  <QuoteCard
                    key={key}
                    text={text}
                    book={book}
                    liked={likes.has(key)}
                    onToggle={() => toggleLike(key)}
                    onMakeCard={() => openStudio(text, book, idx)}
                  />
                );
              })}
            </div>

            {/* 分页控件：超过 10 句时显示 */}
            {totalQuotePages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-8">
                <button
                  type="button"
                  onClick={() => setQuotePage((p) => Math.max(1, p - 1))}
                  disabled={quotePage === 1}
                  className="w-8 h-8 flex items-center justify-center rounded-full bg-white border border-stone-200 text-ink-muted hover:bg-stone-50 disabled:opacity-30 transition-colors text-sm"
                >
                  ‹
                </button>
                {Array.from({ length: totalQuotePages }, (_, i) => i + 1).map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setQuotePage(n)}
                    className={`w-8 h-8 flex items-center justify-center rounded-full text-sm font-medium transition-colors ${
                      n === quotePage
                        ? "bg-shelf-500 text-white"
                        : "bg-white border border-stone-200 text-ink-muted hover:bg-stone-50"
                    }`}
                  >
                    {n}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setQuotePage((p) => Math.min(totalQuotePages, p + 1))}
                  disabled={quotePage === totalQuotePages}
                  className="w-8 h-8 flex items-center justify-center rounded-full bg-white border border-stone-200 text-ink-muted hover:bg-stone-50 disabled:opacity-30 transition-colors text-sm"
                >
                  ›
                </button>
              </div>
            )}
          </>
        )}
      </main>

      {studio && (
        <QuoteStudio
          initialText={studio.initialText}
          initialBookTitle={studio.initialBookTitle}
          initialAuthor={studio.initialAuthor}
          initialStyle={studio.initialStyle}
          styleKey={studio.styleKey}
          onSaved={studio.canSave ? handleQuoteSaved : undefined}
          onTextChanged={studio.onTextChanged}
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
    <div className="bg-white rounded-2xl shadow-sm border border-stone-100 p-5 flex gap-4 relative">
      {book.coverUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={book.coverUrl} alt={book.bookTitle}
          className="w-12 h-16 object-cover rounded-lg shrink-0 shadow-sm" />
      ) : (
        <div className="w-12 h-16 bg-shelf-100 rounded-lg shrink-0 flex items-center justify-center">
          <span className="text-lg">📚</span>
        </div>
      )}

      {/* 内容区：pb-9 留出右下角按钮的空间 */}
      <div className="flex-1 min-w-0 pb-9">
        <p className="text-ink text-base leading-relaxed border-l-2 border-shelf-300 pl-3 mb-3 break-words">
          {text}
        </p>
        <div className="min-w-0">
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
      </div>

      {/* 🎨 和 ❤️ 固定在卡片右下角，absolute 让位置不受内容高度影响 */}
      <div className="absolute bottom-4 right-4 flex items-center gap-1">
        <div className="relative group">
          <button type="button" onClick={onMakeCard}
            className="w-8 h-8 flex items-center justify-center rounded-full text-stone-300 hover:text-shelf-500 hover:bg-shelf-50 transition-colors text-base">
            🎨
          </button>
          <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 bg-ink text-white text-[10px] rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
            制作语录卡
          </span>
        </div>

        <button type="button" onClick={onToggle}
          aria-label={liked ? "取消收藏" : "收藏"}
          className={`w-8 h-8 flex items-center justify-center rounded-full transition-colors ${
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
  );
}
