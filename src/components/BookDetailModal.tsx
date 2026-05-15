"use client";

import { useEffect, useState, useCallback } from "react";
import type { BookDetail, BookInfo } from "@/types/book";
import { GENRE_LABELS, COUNTRY_OPTIONS } from "@/lib/notion-fields";

type Props = {
  pageId: string | null;   // null = modal 关闭
  onClose: () => void;
  onUpdated?: (book: BookDetail) => void;
};

export default function BookDetailModal({ pageId, onClose, onUpdated }: Props) {
  const [book, setBook] = useState<BookDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 编辑中的草稿值，只在编辑模式生效
  const [draft, setDraft] = useState<Partial<BookInfo>>({});

  // pageId 变化时重新拉取书籍详情
  const fetchBook = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    setEditing(false);
    setDraft({});
    try {
      const res = await fetch(`/api/books/${id}`);
      if (!res.ok) throw new Error((await res.json()).error);
      setBook(await res.json());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (pageId) fetchBook(pageId);
    else setBook(null);
  }, [pageId, fetchBook]);

  // 按 Esc 关闭 modal（行业惯例：modal 都应该支持 Esc 关闭）
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  // 打开 modal 时禁止 body 滚动
  useEffect(() => {
    if (pageId) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [pageId]);

  const handleSave = async () => {
    if (!book || Object.keys(draft).length === 0) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/books/${book.pageId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      // 保存成功：把草稿合并到展示状态
      const updated = { ...book, ...draft } as BookDetail;
      setBook(updated);
      onUpdated?.(updated);
      setEditing(false);
      setDraft({});
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  // modal 没打开时不渲染任何内容
  if (!pageId) return null;

  return (
    // 遮罩层：点击遮罩关闭 modal
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 px-0 sm:px-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* modal 容器：手机全屏底部弹出，桌面居中弹窗 */}
      <div className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl max-h-[92dvh] overflow-y-auto flex flex-col">

        {/* 顶部把手（手机样式） + 关闭按钮 */}
        <div className="flex items-center justify-between px-4 pt-4 pb-2 shrink-0">
          <div className="w-10 h-1 bg-stone-200 rounded-full sm:hidden mx-auto absolute left-1/2 -translate-x-1/2 top-3" />
          <span className="text-sm font-medium text-ink-muted">书籍详情</span>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-stone-100 hover:bg-stone-200 text-ink-muted text-lg leading-none transition-colors"
          >
            ×
          </button>
        </div>

        {/* 内容区 */}
        <div className="flex-1 overflow-y-auto px-4 pb-6">
          {loading && (
            <div className="animate-pulse space-y-4 pt-2">
              <div className="flex gap-4">
                <div className="w-24 h-32 bg-stone-200 rounded-xl shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-5 bg-stone-200 rounded w-3/4" />
                  <div className="h-4 bg-stone-100 rounded w-1/2" />
                  <div className="h-4 bg-stone-100 rounded w-1/3" />
                </div>
              </div>
              <div className="h-4 bg-stone-100 rounded" />
              <div className="h-4 bg-stone-100 rounded w-5/6" />
            </div>
          )}

          {error && (
            <div className="text-red-500 text-sm py-4 text-center">{error}</div>
          )}

          {book && !loading && (
            <div className="space-y-4 pt-1">
              {/* 封面 + 核心信息 */}
              <div className="flex gap-4">
                <div className="w-24 h-32 shrink-0 rounded-xl overflow-hidden bg-stone-100 shadow-sm">
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

                <div className="flex-1 min-w-0 space-y-1.5 pt-0.5">
                  {editing ? (
                    // 编辑态：书名变成 input
                    <input
                      className="w-full font-bold text-ink text-base border-b border-shelf-300 outline-none bg-transparent pb-0.5"
                      value={draft.title ?? book.title}
                      onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
                    />
                  ) : (
                    <h2 className="font-bold text-ink text-base leading-tight">{book.title}</h2>
                  )}
                  {(editing ? (draft.subtitle ?? book.subtitle) : book.subtitle) !== null || editing ? (
                    editing ? (
                      <input
                        placeholder="副标题（选填）"
                        className="w-full text-xs text-ink-muted border-b border-stone-200 outline-none bg-transparent pb-0.5"
                        value={draft.subtitle ?? book.subtitle ?? ""}
                        onChange={(e) => setDraft((d) => ({ ...d, subtitle: e.target.value || null }))}
                      />
                    ) : (
                      book.subtitle && <p className="text-xs text-ink-muted">{book.subtitle}</p>
                    )
                  ) : null}
                  {editing ? (
                    <input
                      className="w-full text-sm text-ink-muted border-b border-stone-200 outline-none bg-transparent pb-0.5"
                      value={draft.author ?? book.author}
                      onChange={(e) => setDraft((d) => ({ ...d, author: e.target.value }))}
                    />
                  ) : (
                    <p className="text-sm text-ink-muted">{book.author}</p>
                  )}
                </div>
              </div>

              {/* 国家 + 类型标签 */}
              <div className="space-y-2">
                {editing ? (
                  // 国家选择器
                  <div>
                    <label className="text-xs text-ink-light mb-1 block">国家</label>
                    <select
                      className="text-xs border border-stone-200 rounded-lg px-2 py-1.5 bg-white text-ink w-full"
                      value={draft.country ?? book.country ?? ""}
                      onChange={(e) => setDraft((d) => ({ ...d, country: (e.target.value || null) as BookDetail["country"] }))}
                    >
                      <option value="">未知</option>
                      {COUNTRY_OPTIONS.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                ) : (
                  book.country && (
                    <span className="inline-block bg-shelf-100 text-shelf-700 text-xs px-2 py-0.5 rounded-full">
                      {book.country}
                    </span>
                  )
                )}

                {editing ? (
                  // 类型多选（checkbox 列表）
                  <div>
                    <label className="text-xs text-ink-light mb-1.5 block">类型标签</label>
                    <div className="flex flex-wrap gap-1.5">
                      {GENRE_LABELS.map((g) => {
                        const selected = (draft.genres ?? book.genres).includes(g);
                        return (
                          <button
                            key={g}
                            type="button"
                            onClick={() => {
                              const current = draft.genres ?? [...book.genres];
                              setDraft((d) => ({
                                ...d,
                                genres: selected
                                  ? current.filter((x) => x !== g)
                                  : [...current, g],
                              }));
                            }}
                            className={`text-xs px-2 py-0.5 rounded-full transition-colors ${
                              selected
                                ? "bg-shelf-500 text-white"
                                : "bg-stone-100 text-ink-muted hover:bg-stone-200"
                            }`}
                          >
                            {g}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {book.genres.map((g) => (
                      <span key={g} className="bg-stone-100 text-ink-muted text-xs px-2 py-0.5 rounded-full">
                        {g}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* 简介 */}
              <div>
                <label className="text-xs text-ink-light mb-1 block">简介</label>
                {editing ? (
                  <textarea
                    rows={4}
                    className="w-full text-sm text-ink border border-stone-200 rounded-xl px-3 py-2 outline-none focus:border-shelf-300 resize-none bg-white"
                    value={draft.description ?? book.description}
                    onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
                  />
                ) : (
                  <p className="text-sm text-ink leading-relaxed">{book.description}</p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* 底部操作栏 */}
        {book && !loading && (
          <div className="shrink-0 border-t border-stone-100 px-4 py-3 flex items-center justify-between gap-3">
            {/* 左：Notion 兜底链接 */}
            <a
              href={book.pageUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-ink-light hover:text-ink-muted transition-colors"
            >
              在 Notion 中打开 ↗
            </a>

            {/* 右：编辑 / 保存 / 取消 */}
            <div className="flex gap-2">
              {editing ? (
                <>
                  <button
                    onClick={() => { setEditing(false); setDraft({}); setError(null); }}
                    className="text-sm text-ink-muted px-4 py-1.5 rounded-full border border-stone-200 hover:bg-stone-50 transition-colors"
                  >
                    取消
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="text-sm text-white bg-shelf-500 hover:bg-shelf-600 disabled:opacity-50 px-4 py-1.5 rounded-full transition-colors"
                  >
                    {saving ? "保存中…" : "保存"}
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setEditing(true)}
                  className="text-sm text-shelf-600 hover:text-shelf-700 px-4 py-1.5 rounded-full border border-shelf-200 hover:bg-shelf-50 transition-colors"
                >
                  ✏️ 编辑
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
