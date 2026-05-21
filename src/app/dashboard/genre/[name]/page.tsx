"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import BookDetailModal from "@/components/BookDetailModal";
import { useLanguage } from "@/contexts/LanguageContext";
import { translateTerm, toZhTerm } from "@/lib/i18n/termMap";
import type { BookSummary } from "@/types/book";

const PAGE_SIZE = 10;

export default function GenrePage({ params }: { params: Promise<{ name: string }> }) {
  const router = useRouter();
  const { lang, t } = useLanguage();
  const [books, setBooks]       = useState<BookSummary[]>([]);
  const [genreName, setGenreName] = useState("");
  const [loading, setLoading]   = useState(true);
  const [modalPageId, setModalPageId] = useState<string | null>(null);
  const [page, setPage]         = useState(1);

  useEffect(() => {
    params.then(({ name }) => {
      const decoded = decodeURIComponent(name);
      setGenreName(decoded);
      // URL 可能是英文名（英文模式）或中文名，统一转回中文再查 Notion
      const zhName = toZhTerm(decoded, "genre");
      fetch(`/api/books?genre=${encodeURIComponent(zhName)}`)
        .then((r) => r.json())
        .then(setBooks)
        .finally(() => setLoading(false));
    });
  }, [params]);

  if (loading) return (
    <div className="min-h-screen bg-shelf-50 flex items-center justify-center">
      <div className="animate-spin w-8 h-8 border-2 border-shelf-300 border-t-shelf-500 rounded-full" />
    </div>
  );

  const totalPages = Math.ceil(books.length / PAGE_SIZE);
  const pageBooks  = books.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="min-h-screen bg-shelf-50">
      {/* Header */}
      <header className="bg-white border-b border-stone-100 px-5 py-4 flex items-center gap-3 sticky top-0 z-20 shadow-sm">
        <button
          type="button"
          onClick={() => router.back()}
          className="w-8 h-8 flex items-center justify-center rounded-full bg-stone-100 hover:bg-stone-200 text-ink-muted transition-colors"
        >
          ←
        </button>
        <div>
          <h1 className="font-bold text-ink text-base">{translateTerm(genreName, "genre", lang)}</h1>
          <p className="text-xs text-ink-muted">{t.dashboard.booksUnit(books.length)}</p>
        </div>
      </header>

      {/* 封面墙网格 */}
      <main className="max-w-2xl mx-auto px-4 py-5">
        {books.length === 0 ? (
          <p className="text-center text-ink-muted text-sm py-16">暂无书籍</p>
        ) : (
          <>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
              {pageBooks.map((book) => (
                <button
                  key={book.pageId}
                  type="button"
                  onClick={() => setModalPageId(book.pageId)}
                  className="text-left group"
                >
                  <div className="aspect-[3/4] rounded-xl overflow-hidden bg-stone-100 shadow-sm group-hover:shadow-md transition-shadow mb-1.5">
                    {book.coverUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={book.coverUrl}
                        alt={book.title}
                        className="w-full h-full object-cover"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-3xl bg-shelf-50">📖</div>
                    )}
                  </div>
                  <p className="text-xs text-ink font-medium line-clamp-2 leading-snug">{book.title}</p>
                  <p className="text-xs text-ink-muted mt-0.5 truncate">{book.author}</p>
                </button>
              ))}
            </div>

            {/* 分页控件：超过 10 本时显示 */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-8">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="w-8 h-8 flex items-center justify-center rounded-full bg-white border border-stone-200 text-ink-muted hover:bg-stone-50 disabled:opacity-30 transition-colors text-sm"
                >
                  ‹
                </button>

                {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setPage(n)}
                    className={`w-8 h-8 flex items-center justify-center rounded-full text-sm font-medium transition-colors ${
                      n === page
                        ? "bg-shelf-500 text-white"
                        : "bg-white border border-stone-200 text-ink-muted hover:bg-stone-50"
                    }`}
                  >
                    {n}
                  </button>
                ))}

                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="w-8 h-8 flex items-center justify-center rounded-full bg-white border border-stone-200 text-ink-muted hover:bg-stone-50 disabled:opacity-30 transition-colors text-sm"
                >
                  ›
                </button>
              </div>
            )}
          </>
        )}
      </main>

      <BookDetailModal
        pageId={modalPageId}
        onClose={() => setModalPageId(null)}
      />
    </div>
  );
}
