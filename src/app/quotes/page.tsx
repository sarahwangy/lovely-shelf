"use client";

import { useEffect, useState } from "react";
import NavBar from "@/components/NavBar";
import type { QuoteBook } from "@/app/api/quotes/route";

// 每张语录卡的唯一键：pageId + 语句在该书中的下标
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

export default function QuotesPage() {
  const [books,  setBooks]  = useState<QuoteBook[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  // likes 是一个 Set，存所有已点赞的 likeKey
  const [likes,  setLikes]  = useState<Set<string>>(new Set());

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

  // 把所有书的语句展开成一个扁平列表，每条带上书的信息
  const allQuotes = books.flatMap((book) =>
    book.quotes.map((text, idx) => ({ text, idx, book }))
  );

  const likedQuotes   = allQuotes.filter(({ book, idx }) => likes.has(likeKey(book.pageId, idx)));
  const unlikedQuotes = allQuotes.filter(({ book, idx }) => !likes.has(likeKey(book.pageId, idx)));

  return (
    <div className="min-h-screen bg-stone-50">
      <NavBar />

      <main className="max-w-2xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-ink mb-1">语录</h1>
          <p className="text-sm text-ink-muted">
            书架里收录的优美语句 · 共 {allQuotes.length} 句
          </p>
        </div>

        {loading && (
          <div className="text-center py-20 text-ink-muted">加载中…</div>
        )}

        {error && (
          <div className="text-center py-20 text-red-400">{error}</div>
        )}

        {!loading && !error && allQuotes.length === 0 && (
          <div className="text-center py-20 text-ink-muted">
            <p className="text-4xl mb-3">✨</p>
            <p>还没有语录，去上传第一本书吧</p>
          </div>
        )}

        {/* 收藏区 */}
        {likedQuotes.length > 0 && (
          <section className="mb-8">
            <h2 className="text-xs font-semibold text-ink-muted uppercase tracking-wider mb-3">
              已收藏 ({likedQuotes.length})
            </h2>
            <div className="flex flex-col gap-4">
              {likedQuotes.map(({ text, idx, book }) => (
                <QuoteCard
                  key={likeKey(book.pageId, idx)}
                  text={text}
                  book={book}
                  liked
                  onToggle={() => toggleLike(likeKey(book.pageId, idx))}
                />
              ))}
            </div>
          </section>
        )}

        {/* 所有语录 */}
        {unlikedQuotes.length > 0 && (
          <section>
            {likedQuotes.length > 0 && (
              <h2 className="text-xs font-semibold text-ink-muted uppercase tracking-wider mb-3">
                全部语录
              </h2>
            )}
            <div className="flex flex-col gap-4">
              {unlikedQuotes.map(({ text, idx, book }) => (
                <QuoteCard
                  key={likeKey(book.pageId, idx)}
                  text={text}
                  book={book}
                  liked={false}
                  onToggle={() => toggleLike(likeKey(book.pageId, idx))}
                />
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

// 单张语录卡：语句内容 + 来源书籍 + 收藏按钮
function QuoteCard({
  text,
  book,
  liked,
  onToggle,
}: {
  text:     string;
  book:     QuoteBook;
  liked:    boolean;
  onToggle: () => void;
}) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-stone-100 p-5 flex gap-4">
      {/* 封面缩略图 */}
      {book.coverUrl ? (
        <img
          src={book.coverUrl}
          alt={book.bookTitle}
          className="w-12 h-16 object-cover rounded-lg shrink-0 shadow-sm"
        />
      ) : (
        // 无封面时用占位色块
        <div className="w-12 h-16 bg-shelf-100 rounded-lg shrink-0 flex items-center justify-center">
          <span className="text-lg">📚</span>
        </div>
      )}

      {/* 语录正文 + 书籍信息 */}
      <div className="flex-1 min-w-0">
        {/* 语句：大字，左侧加装饰竖线 */}
        <p className="text-ink text-base leading-relaxed border-l-2 border-shelf-300 pl-3 mb-3">
          {text}
        </p>

        {/* 书名 + 作者 */}
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <a
              href={book.notionUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-shelf-600 hover:underline truncate block"
            >
              {book.bookTitle}
            </a>
            {book.author && (
              <p className="text-xs text-ink-muted mt-0.5">{book.author}</p>
            )}
          </div>

          {/* 收藏按钮 */}
          <button
            type="button"
            onClick={onToggle}
            aria-label={liked ? "取消收藏" : "收藏"}
            className={`shrink-0 w-8 h-8 flex items-center justify-center rounded-full transition-colors ${
              liked
                ? "text-red-500 bg-red-50 hover:bg-red-100"
                : "text-stone-300 hover:text-red-400 hover:bg-red-50"
            }`}
          >
            {/* filled heart when liked, outline when not */}
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
